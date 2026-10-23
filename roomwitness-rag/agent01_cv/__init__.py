"""
Compatibility shim — exposes run_cv_assessment and run_evidence_analysis
with the original flat signatures so portal/app.py imports work unchanged:

    from agent01_cv import run_cv_assessment
"""

import itertools
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
from agent01_cv.cv import assess_claim, prepare_image, MODEL
from agent01_cv.evidence import run_evidence_analysis as _run_evidence_analysis

try:
    from langsmith import traceable
except ImportError:
    def traceable(**_):
        def _wrap(fn): return fn
        return _wrap


_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_gemini_keys = [k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()]
_gemini_cycle = itertools.cycle(_gemini_keys) if _gemini_keys else None
_gemini_lock = threading.Lock()


def _next_gemini_key() -> str:
    with _gemini_lock:
        return next(_gemini_cycle)


# ponytail: Groq retired its vision model (llama-4-scout) with no free-tier
# replacement; Bedrock is blocked by an org SCP. VLM_PROVIDER=gemini (deployed)
# round-robins across GEMINI_API_KEYS (comma-separated) so one quota-limited
# key doesn't stall the whole demo. VLM_PROVIDER=bedrock kept for when that
# clears; local dev defaults to a local LM Studio VLM.
def _get_client():
    if os.getenv("VLM_PROVIDER") == "gemini":
        if not _gemini_cycle:
            raise RuntimeError("VLM_PROVIDER=gemini but GEMINI_API_KEYS is empty")
        return OpenAI(api_key=_next_gemini_key(), base_url=_GEMINI_BASE_URL)
    if os.getenv("VLM_PROVIDER") == "bedrock":
        from shared.bedrock_vision_client import get_bedrock_vision_client
        return get_bedrock_vision_client()
    return OpenAI(
        api_key=os.getenv("VLM_API_KEY", "lm-studio"),
        base_url=os.getenv("VLM_BASE_URL", "http://localhost:1234/v1"),
    )


@traceable(name="agent01/run_cv_assessment", run_type="chain")
def run_cv_assessment(
    move_in_paths: list,
    move_out_paths: list,
    landlord_claims: list,
) -> dict:
    """Original flat signature — creates Groq client internally."""
    move_in_b64s  = [prepare_image(p) for p in move_in_paths  if p]
    move_out_b64s = [prepare_image(p) for p in move_out_paths if p]

    # ponytail: calls run concurrently (the VLM serves them in parallel, not
    # queued) so N claims cost ~1 call's latency instead of N calls' latency —
    # needed since Next.js's dev rewrite proxy aborts around 30s. Client is
    # created per-claim (not once, shared) so Gemini key rotation actually
    # spreads load across keys instead of pinning one key for the whole run.
    def _assess(claim):
        return assess_claim(
            move_in_b64s=move_in_b64s,
            move_out_b64s=move_out_b64s,
            claim_item=claim["item"],
            claim_description=claim.get("description", ""),
            claim_amount=float(claim.get("amount_thb", 0)),
            client=_get_client(),
        )

    # capped — an attacker-controlled claims list shouldn't spawn unbounded threads
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(landlord_claims)))) as pool:
        assessments = list(pool.map(_assess, landlord_claims))

    disputed = sum(1 for a in assessments if a.get("supports_landlord_claim") == "NO")
    return {
        "claim_assessments": assessments,
        "summary": {
            "total_claims": len(assessments),
            "supported_claims": sum(1 for a in assessments if a.get("supports_landlord_claim") == "YES"),
            "disputed_claims": disputed,
            "partial_claims": sum(1 for a in assessments if a.get("supports_landlord_claim") == "PARTIAL"),
            "low_confidence_items": [a["item"] for a in assessments if (a.get("confidence") or 0) < 0.4],
            "total_disputed_amount": sum(
                float(landlord_claims[i].get("amount_thb", 0))
                for i, a in enumerate(assessments)
                if a.get("supports_landlord_claim") == "NO"
            ),
            "assessment_notes": f"{disputed} of {len(assessments)} claims disputed by photo evidence.",
        },
        "model_used": MODEL,
        "images_used": {"move_in": move_in_paths, "move_out": move_out_paths},
    }


def run_evidence_analysis(
    screenshot_paths: list,
    manual_landlord_promises: str = "",
    manual_tenant_promises: str = "",
) -> dict:
    """Original flat signature — creates Groq client internally."""
    return _run_evidence_analysis(
        screenshot_paths=screenshot_paths,
        manual_landlord_promises=manual_landlord_promises,
        manual_tenant_promises=manual_tenant_promises,
        client=_get_client(),
    )
