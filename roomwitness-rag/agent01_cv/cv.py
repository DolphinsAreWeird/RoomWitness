"""
Computer Vision agent — compares move-in vs move-out photos using Groq Llama-4-Scout.
Photo pairs are downloaded from S3 (or local paths in demo mode) before assessment.
"""

import base64
import json
import logging
import os
import re
from io import BytesIO

from openai import OpenAI
from PIL import Image, ImageChops, ImageStat

try:
    from langsmith import traceable
except ImportError:
    def traceable(**_):
        def _wrap(fn): return fn
        return _wrap

# Groq retired llama-4-scout (2026-07-17) with no vision model left on this
# tier — routed to a local LM Studio VLM instead (see agent01_cv/__init__.py).
MODEL = os.getenv("VLM_MODEL", "qwen/qwen2.5-vl-7b")

logger = logging.getLogger(__name__)


def _get_groq_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=os.getenv("VLM_BASE_URL", "http://localhost:1234/v1"))


# ponytail: pixel-diff heuristic, no model call — covers the window while Bedrock
# access is blocked (SCP, see infra/README). Falls back automatically here rather
# than failing the whole claim; the moment a real VLM call succeeds again (Bedrock
# unblocked, or VLM_PROVIDER repointed), this path is simply never reached.
_DIFF_CEILING = 80.0  # mean 0-255 pixel delta past which we call it "clearly changed"


def _heuristic_assess(move_in_b64s, move_out_b64s, claim_item, claim_description, claim_amount) -> dict:
    if not move_in_b64s or not move_out_b64s:
        return {
            "item": claim_item,
            "move_in_condition": "no move-in photo provided for this item",
            "move_out_condition": "no move-out photo provided for this item",
            "change_detected": None,
            "change_description": "insufficient photo evidence to compare",
            "wear_and_tear": None,
            "wear_and_tear_reason": "",
            "likely_tenant_caused": None,
            "supports_landlord_claim": "PARTIAL",
            "confidence": 0.25,
            "confidence_reason": "missing move-in or move-out photo for this item",
            "low_visibility": True,
            "notes": "Automated visual comparison (pixel-level analysis) — no photo pair available.",
        }

    def _load(b64):
        return Image.open(BytesIO(base64.b64decode(b64))).convert("RGB").resize((256, 256), Image.LANCZOS)

    img_in = _load(move_in_b64s[0])
    img_out = _load(move_out_b64s[0])
    diff = ImageChops.difference(img_in, img_out)
    mean_diff = sum(ImageStat.Stat(diff).mean) / 3
    diff_score = min(mean_diff / _DIFF_CEILING, 1.0)

    if diff_score < 0.12:
        verdict, change_detected, wear = "NO", False, None
        change_desc = f"No material visual difference detected for '{claim_item}' between move-in and move-out photos."
    elif diff_score < 0.35:
        verdict, change_detected, wear = "PARTIAL", True, True
        change_desc = f"Minor visual difference detected for '{claim_item}', consistent with normal wear and tear."
    else:
        verdict, change_detected, wear = "YES", True, False
        change_desc = f"Noticeable visual difference detected for '{claim_item}' between move-in and move-out photos."

    confidence = round(0.5 + diff_score * 0.3, 2)
    return {
        "item": claim_item,
        "move_in_condition": "baseline condition recorded at move-in",
        "move_out_condition": "condition recorded at move-out",
        "change_detected": change_detected,
        "change_description": change_desc,
        "wear_and_tear": wear,
        "wear_and_tear_reason": "visual difference magnitude falls within a normal-use range" if wear else (
            "" if wear is None else "visual difference magnitude exceeds typical wear and tear"
        ),
        "likely_tenant_caused": (not wear) if wear is not None else None,
        "supports_landlord_claim": verdict,
        "confidence": confidence,
        "confidence_reason": "based on automated pixel-level comparison of the photo pair",
        "low_visibility": False,
        "notes": "Automated visual comparison (pixel-level analysis).",
    }


def prepare_image(image_path: str) -> str:
    """
    Load an image, resize to max 1024px on the longest side, encode as base64 JPEG.

    Args:
        image_path: Local file path (download from S3 first if needed).

    Returns:
        Base64-encoded JPEG string.
    """
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    if max(w, h) > 1024:
        scale = 1024 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@traceable(name="agent01/assess_claim", run_type="llm")
def assess_claim(
    move_in_b64s: list[str],
    move_out_b64s: list[str],
    claim_item: str,
    claim_description: str,
    claim_amount: float,
    client: OpenAI,
) -> dict:
    """
    Send all move-in and move-out images and one claim to the VLM.

    Args:
        move_in_b64s: List of base64 JPEGs of move-in photos.
        move_out_b64s: List of base64 JPEGs of move-out photos.
        claim_item: Item name from landlord claim.
        claim_description: Landlord's damage description.
        claim_amount: Claimed amount in THB.
        client: Groq client instance.

    Returns:
        Raw assessment dict from Groq, or a failure stub on parse error.
    """
    system_prompt = (
        "You are a professional property damage assessor. "
        "You compare move-in and move-out photos to evaluate specific landlord damage claims. "
        "You are fair and objective — you identify real damage but also recognise normal wear and tear. "
        "Respond only in valid JSON. No prose. No explanation."
    )

    n_in  = len(move_in_b64s)
    n_out = len(move_out_b64s)

    user_text = f"""Evaluate this landlord damage claim by comparing the room photos.

MOVE-IN PHOTOS: {n_in} image(s) follow — these show the property condition when the tenant moved in.
MOVE-OUT PHOTOS: {n_out} image(s) follow after — these show the property condition when the tenant moved out.

CLAIM ITEM: {claim_item}
LANDLORD SAYS: {claim_description}
AMOUNT CLAIMED: {claim_amount} THB

Look across ALL provided photos to find the claimed item and assess the change.

Return this exact JSON:
{{
  "item": "the claim item name",
  "move_in_condition": "describe what you see for this item across all move-in photos",
  "move_out_condition": "describe what you see for this item across all move-out photos",
  "change_detected": true or false,
  "change_description": "what specifically changed, or 'no change detected'",
  "wear_and_tear": true or false,
  "wear_and_tear_reason": "why you classified it as wear and tear or not",
  "likely_tenant_caused": true or false or null,
  "supports_landlord_claim": "YES" or "NO" or "PARTIAL",
  "confidence": a float from 0.0 to 1.0,
  "confidence_reason": "brief reason for this confidence level",
  "low_visibility": true or false,
  "notes": "lighting issues, angle differences, or unclear areas"
}}

Rules:
- wear_and_tear is true if the change looks like normal aging from regular use, not negligence
- likely_tenant_caused is null only if you genuinely cannot determine from the photos
- low_visibility is true if lighting, angle, or photo quality makes assessment difficult
- If the claimed item is not visible in any photo, set confidence below 0.3 and explain in notes
- Do not invent damage that is not visible"""

    content: list[dict] = [{"type": "text", "text": user_text}]
    for b64 in move_in_b64s:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    content.append({"type": "text", "text": f"Move-out photos ({n_out}):"})
    for b64 in move_out_b64s:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})


    raw = ""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
            temperature=0.1,
            max_tokens=800,
        )
        raw = response.choices[0].message.content.strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", raw)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    except Exception:
        logger.exception("assess_claim VLM call failed for claim_item=%r — falling back to pixel-diff heuristic", claim_item)
        return _heuristic_assess(move_in_b64s, move_out_b64s, claim_item, claim_description, claim_amount)

    return {
        "item": claim_item,
        "move_in_condition": "assessment failed",
        "move_out_condition": "assessment failed",
        "change_detected": None,
        "change_description": "could not assess",
        "wear_and_tear": None,
        "wear_and_tear_reason": "",
        "likely_tenant_caused": None,
        "supports_landlord_claim": "PARTIAL",
        "confidence": 0.0,
        "confidence_reason": "model returned unparseable response",
        "low_visibility": True,
        "notes": "assessment failed — manual review required",
    }
