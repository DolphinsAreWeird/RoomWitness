"""
Conversation screenshot analyzer — reads LINE/WhatsApp/SMS screenshots via Groq Llama-4-Scout.
Extracts promises, deposit mentions, and overall tone for use as supporting evidence in Agent 03.
"""

import base64
import json
import logging
import os
import re
from io import BytesIO

from openai import OpenAI
from PIL import Image

# Groq retired llama-4-scout (2026-07-17) with no vision model left on this
# tier — routed to a local LM Studio VLM instead (see agent01_cv/__init__.py).
MODEL = (
    os.getenv("BEDROCK_MODEL_ID", "")
    if os.getenv("VLM_PROVIDER") == "bedrock"
    else os.getenv("VLM_MODEL", "qwen/qwen2.5-vl-7b")
)

logger = logging.getLogger(__name__)


def _encode_image(image_path: str) -> str:
    """Resize to max 1024px longest side, return base64 JPEG string."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    if max(w, h) > 1024:
        scale = 1024 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def extract_from_screenshot(image_path: str, screenshot_index: int, client: OpenAI) -> dict:
    """
    Send one conversation screenshot to Llama-4-Scout and extract structured evidence.

    Args:
        image_path: Local path to the screenshot image.
        screenshot_index: 0-based index for prompt context.
        client: Groq client instance.

    Returns:
        Structured extraction dict with messages, promises, tone.
    """
    system_prompt = (
        "You are an expert at reading chat screenshots (LINE, WhatsApp, iMessage, SMS, email). "
        "Extract the full conversation text and identify any statements relevant to a rental deposit dispute. "
        "Respond only in valid JSON. No prose."
    )

    user_text = f"""This is conversation screenshot #{screenshot_index + 1} from a Thai rental deposit dispute.

Extract all readable text and identify key statements.

Return this exact JSON:
{{
  "readable": true or false,
  "platform": "LINE" or "WhatsApp" or "SMS" or "email" or "other" or "unknown",
  "language": "th" or "en" or "mixed",
  "messages": [
    {{
      "sender": "landlord" or "tenant" or "unknown",
      "text": "exact message text",
      "timestamp": "date/time if visible, else null"
    }}
  ],
  "landlord_promises": ["direct quote or paraphrase of any promise made by the landlord"],
  "tenant_promises": ["direct quote or paraphrase of any promise made by the tenant"],
  "deposit_mentions": ["any sentence that mentions deposit, refund, deduction, damage, repair costs"],
  "overall_tone": "cooperative" or "disputed" or "threatening" or "neutral",
  "key_date": "most relevant date mentioned, or null",
  "notes": "anything unusual, unreadable sections, or important context"
}}

Rules:
- If the screenshot is unreadable or not a conversation, set readable to false and leave arrays empty
- Preserve original Thai text in the messages array — do not translate
- Classify sender as landlord/tenant based on chat bubble side or name labels when visible
- landlord_promises and tenant_promises should capture anything that could be used as evidence"""

    b64 = _encode_image(image_path)
    raw = ""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ]},
            ],
            temperature=0.1,
            max_tokens=1200,
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
        logger.exception("extract_from_screenshot failed for screenshot #%d", screenshot_index)

    return {
        "readable": False,
        "platform": "unknown",
        "language": "unknown",
        "messages": [],
        "landlord_promises": [],
        "tenant_promises": [],
        "deposit_mentions": [],
        "overall_tone": "neutral",
        "key_date": None,
        "notes": "extraction failed — manual review required",
    }


def run_evidence_analysis(
    screenshot_paths: list[str],
    manual_landlord_promises: str,
    manual_tenant_promises: str,
    client: OpenAI,
) -> dict:
    """
    Process all conversation screenshots plus manually entered promises.

    Returns a unified evidence dict. The `evidence_text` field is a plain-text
    summary ready for injection into Agent 03's reasoning context.

    Args:
        screenshot_paths: Local paths to conversation screenshot images.
        manual_landlord_promises: Newline-separated landlord statements entered by the tenant.
        manual_tenant_promises: Newline-separated tenant statements.
        client: Groq client instance.

    Returns:
        Dict matching EvidenceResult schema.
    """
    screenshot_results = []
    for i, path in enumerate(screenshot_paths):
        result = extract_from_screenshot(path, i, client)
        result["source_file"] = os.path.basename(path)
        screenshot_results.append(result)

    all_landlord_promises: list[str] = []
    all_tenant_promises: list[str] = []
    all_deposit_mentions: list[str] = []
    all_messages: list[dict] = []
    platforms_seen: set[str] = set()
    unreadable_count = 0

    for r in screenshot_results:
        if not r.get("readable"):
            unreadable_count += 1
            continue
        all_landlord_promises.extend(r.get("landlord_promises") or [])
        all_tenant_promises.extend(r.get("tenant_promises") or [])
        all_deposit_mentions.extend(r.get("deposit_mentions") or [])
        all_messages.extend(r.get("messages") or [])
        if r.get("platform"):
            platforms_seen.add(r["platform"])

    for line in manual_landlord_promises.strip().splitlines():
        line = line.strip("•-– ").strip()
        if line:
            all_landlord_promises.append(f"[Manual] {line}")

    for line in manual_tenant_promises.strip().splitlines():
        line = line.strip("•-– ").strip()
        if line:
            all_tenant_promises.append(f"[Manual] {line}")

    summary_lines: list[str] = []
    if all_landlord_promises:
        summary_lines.append("LANDLORD STATEMENTS/PROMISES:")
        summary_lines.extend(f"  • {p}" for p in all_landlord_promises)
    if all_tenant_promises:
        summary_lines.append("TENANT STATEMENTS/PROMISES:")
        summary_lines.extend(f"  • {p}" for p in all_tenant_promises)
    if all_deposit_mentions:
        summary_lines.append("DEPOSIT-RELATED MENTIONS:")
        summary_lines.extend(f"  • {m}" for m in all_deposit_mentions)

    evidence_text = "\n".join(summary_lines) if summary_lines else "No evidence extracted."

    return {
        "screenshots_processed": len(screenshot_paths),
        "screenshots_unreadable": unreadable_count,
        "platforms_detected": list(platforms_seen),
        "screenshot_details": screenshot_results,
        "all_landlord_promises": all_landlord_promises,
        "all_tenant_promises": all_tenant_promises,
        "all_deposit_mentions": all_deposit_mentions,
        "total_messages_extracted": len(all_messages),
        "evidence_text": evidence_text,
        "model_used": MODEL,
    }
