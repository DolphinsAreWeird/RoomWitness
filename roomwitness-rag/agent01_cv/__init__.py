"""
Compatibility shim — exposes run_cv_assessment and run_evidence_analysis
with the original flat signatures so portal/app.py imports work unchanged:

    from agent01_cv import run_cv_assessment
"""

import os
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


# ponytail: Groq retired its vision model (llama-4-scout) with no free-tier
# replacement — routed to a local LM Studio VLM instead. Swap VLM_BASE_URL
# back to a hosted vision API if/when one becomes available.
def _get_client() -> OpenAI:
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
    client = _get_client()
    move_in_b64s  = [prepare_image(p) for p in move_in_paths  if p]
    move_out_b64s = [prepare_image(p) for p in move_out_paths if p]

    # ponytail: calls run concurrently (the VLM serves them in parallel, not
    # queued) so N claims cost ~1 call's latency instead of N calls' latency —
    # needed since Next.js's dev rewrite proxy aborts around 30s.
    def _assess(claim):
        return assess_claim(
            move_in_b64s=move_in_b64s,
            move_out_b64s=move_out_b64s,
            claim_item=claim["item"],
            claim_description=claim.get("description", ""),
            claim_amount=float(claim.get("amount_thb", 0)),
            client=client,
        )

    with ThreadPoolExecutor(max_workers=max(1, len(landlord_claims))) as pool:
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
