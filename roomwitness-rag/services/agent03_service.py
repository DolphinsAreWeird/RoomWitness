"""
Agent 03 bridge service — Legal Reasoning via Typhoon v2 + ChromaDB RAG.

Run from roomwitness-rag/:
    python -m uvicorn services.agent03_service:app --port 8003 --reload
"""

import json
import logging
import os
import sys

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from shared.typhoon_client import get_typhoon_llm

# Make roomwitness-rag/ importable as a package root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent03_legal_reasoning.retriever import (
    build_rag_query,
    format_chunks_for_prompt,
    get_chroma_client,
    get_collection,
    retrieve_chunks,
)
from agent03_legal_reasoning.reasoner import apply_hard_rules, reason_claim
from agent03_legal_reasoning.prompts import SUMMARY_PROMPT
from agent03_legal_reasoning.router import determine_routing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RoomWitness Agent 03 — Legal Reasoning Bridge Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def _get_llm() -> ChatOpenAI | None:
    try:
        return get_typhoon_llm(temperature=0.1)
    except Exception:
        logger.warning("LLM client construction failed — verdicts will use fallback text", exc_info=True)
        return None


@app.get("/health")
def health():
    corpus_ready = False
    try:
        col = get_collection(get_chroma_client())
        corpus_ready = col.count() > 0
    except Exception:
        pass
    return {"status": "ok", "agent": "03", "corpus_ready": corpus_ready}


@app.post("/api/v1/agent03")
async def run_agent03(request: Request):
    data = await request.json()

    claims: list = data.get("claims", [])
    damage_map: list = data.get("damage_map", [])
    contract_clause: str = data.get("contract_clause", "")
    landlord_unit_count: int = int(data.get("landlord_unit_count", 0))
    has_void_clause: bool = bool(data.get("has_void_clause", False))

    if not claims:
        return JSONResponse({"error": "No claims"}, status_code=400)

    llm = _get_llm()
    cv_by_id = {r.get("claim_id"): r for r in damage_map}

    verdicts: list[dict] = []
    total_claimed = 0.0
    total_unlawful = 0.0

    for claim in claims:
        amt = float(claim.get("amount_thb", 0))
        total_claimed += amt
        cv = cv_by_id.get(claim.get("claim_id"), {})

        cv_verdict = cv.get("verdict")
        cv_confidence = float(cv.get("confidence", 0.5))

        if cv.get("status") == "unverifiable_by_cv":
            cv_verdict = "unverifiable_by_cv"
            cv_confidence = 0.0

        # Apply deterministic hard rules first
        forced = apply_hard_rules(
            cv_verdict=cv_verdict,
            cv_confidence=cv_confidence,
            contract_liable=False,
            movein_report_signed=False,
        )

        # If contract has a void clause, a new-damage claim that would be LAWFUL becomes DISPUTED
        if cv_verdict == "NEW_DAMAGE" and has_void_clause and forced is None:
            forced = "DISPUTED"

        # RAG retrieval
        query = build_rag_query(
            claim.get("item", ""),
            claim.get("description", ""),
            cv_verdict,
        )
        try:
            chunks = retrieve_chunks(query, top_k=3)
        except Exception as exc:
            logger.warning("ChromaDB retrieval failed for '%s': %s", claim.get("item"), exc)
            chunks = []
        formatted = format_chunks_for_prompt(chunks)

        # LLM reasoning
        if llm:
            try:
                raw = reason_claim(
                    item=claim.get("item", ""),
                    description=claim.get("description", ""),
                    amount_thb=amt,
                    cv_verdict=cv_verdict,
                    cv_confidence=cv_confidence,
                    contract_liable=False,
                    movein_report_signed=False,
                    formatted_chunks=formatted,
                    forced_verdict=forced,
                    llm=llm,
                )
            except Exception as exc:
                logger.warning("reason_claim failed for '%s': %s", claim.get("item"), exc)
                raw = {
                    "verdict": forced or "DISPUTED",
                    "reasoning_th": "ไม่สามารถวิเคราะห์ได้",
                    "reasoning_en": "Analysis failed",
                    "citations": [],
                    "recommended_action_th": "ขอคำแนะนำจากผู้เชี่ยวชาญ",
                    "claim_validity_pct": 0,
                }
        else:
            raw = {
                "verdict": forced or "DISPUTED",
                "reasoning_th": "ไม่สามารถวิเคราะห์ได้ (TYPHOON_API_KEY not configured)",
                "reasoning_en": "Analysis unavailable — Typhoon API key not set",
                "citations": [],
                "recommended_action_th": "กรุณาตั้งค่า TYPHOON_API_KEY ใน .env",
                "claim_validity_pct": 0,
            }

        verdict = raw.get("verdict", "DISPUTED")
        if verdict == "UNLAWFUL":
            total_unlawful += amt

        verdicts.append({
            "claim_id": claim.get("claim_id"),
            "item": claim.get("item"),
            "amount_thb": amt,
            "verdict": verdict,
            "reasoning_th": raw.get("reasoning_th", ""),
            "reasoning_en": raw.get("reasoning_en", ""),
            "citations": raw.get("citations", []),
            "recommended_action_th": raw.get("recommended_action_th", ""),
            "claim_validity_pct": int(raw.get("claim_validity_pct", 0)),
            "confidence": cv_confidence,
        })

    routing_result = determine_routing(landlord_unit_count)

    # Generate case summary
    case_summary_th = ""
    case_summary_en = ""
    pct = round(total_unlawful / total_claimed * 100) if total_claimed else 0

    if llm:
        try:
            summary_chain = SUMMARY_PROMPT | llm | JsonOutputParser()
            summary = summary_chain.invoke({
                "verdicts_json": json.dumps(verdicts, ensure_ascii=False),
                "total_claimed_thb": total_claimed,
                "total_unlawful_thb": total_unlawful,
                "routing": routing_result["route"],
            })
            case_summary_th = summary.get("case_summary_th", "")
            case_summary_en = summary.get("case_summary_en", "")
        except Exception as exc:
            logger.warning("Summary generation failed: %s", exc)

    if not case_summary_th:
        case_summary_th = (
            f"ผู้เช่าถูกเรียกร้องค่าเสียหายรวม {total_claimed:,.0f} บาท "
            f"พบว่า {total_unlawful:,.0f} บาท ({pct}%) ไม่ชอบด้วยกฎหมาย "
            f"แนะนำให้ดำเนินการตามเส้นทาง {routing_result['route']}"
        )
    if not case_summary_en:
        case_summary_en = (
            f"Tenant faces {total_claimed:,.0f} THB in claims; "
            f"{total_unlawful:,.0f} THB ({pct}%) unlawful under OCPB 2568 / CCC §537-571. "
            f"Recommended route: {routing_result['route']}."
        )

    return {
        "routing": routing_result["route"],
        "documents_to_generate": routing_result["documents_to_generate"],
        "total_claimed_thb": total_claimed,
        "total_unlawful_thb": total_unlawful,
        "verdicts": verdicts,
        "case_summary_th": case_summary_th,
        "case_summary_en": case_summary_en,
    }
