# RoomWitness — Agent Prompt Reference

Exact prompts used by each agent in the 4-agent pipeline. Thai prompts are shown
verbatim with an English gloss. This reflects the real code, not the (stale) high-level
description in `CLAUDE.md`.

**Model split**
- Agents 01a / 01b (vision) → **Groq `meta-llama/llama-4-scout-17b-16e-instruct`**
- Agents 02 / 03 / 04 (text) → **Typhoon v2** via LangChain (`ChatOpenAI` + `JsonOutputParser`)

**Shared design pattern:** JSON-only output, low temperature, source-locked citations
(Agent 03 may cite only the retrieved RAG chunks; Agent 04 only Agent 03's citation list),
each with a single self-correcting retry.

---

## Agent 01a — CV Comparison

`agent01_cv/cv.py::assess_claim` — Groq Llama-4-Scout, `temperature=0.1`, `max_tokens=800`, multimodal.

**System prompt**
```
You are a professional property damage assessor. You compare move-in and move-out photos to evaluate specific landlord damage claims. You are fair and objective — you identify real damage but also recognise normal wear and tear. Respond only in valid JSON. No prose. No explanation.
```

**User prompt** (f-string, vars filled per claim)
```
Evaluate this landlord damage claim by comparing the room photos.

MOVE-IN PHOTOS: {n_in} image(s) follow — these show the property condition when the tenant moved in.
MOVE-OUT PHOTOS: {n_out} image(s) follow after — these show the property condition when the tenant moved out.

CLAIM ITEM: {claim_item}
LANDLORD SAYS: {claim_description}
AMOUNT CLAIMED: {claim_amount} THB

Look across ALL provided photos to find the claimed item and assess the change.

Return this exact JSON:
{
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
}

Rules:
- wear_and_tear is true if the change looks like normal aging from regular use, not negligence
- likely_tenant_caused is null only if you genuinely cannot determine from the photos
- low_visibility is true if lighting, angle, or photo quality makes assessment difficult
- If the claimed item is not visible in any photo, set confidence below 0.3 and explain in notes
- Do not invent damage that is not visible
```

**Message assembly:** `user_text` → move-in images → text `"Move-out photos (N):"` → move-out images.
On JSON parse failure: regex-extract first `{...}`, else return a PARTIAL / 0.0-confidence stub.

---

## Agent 01b — Evidence Extraction

`agent01_cv/evidence.py::extract_from_screenshot` — Groq Llama-4-Scout, `temperature=0.1`,
`max_tokens=1200`. One call per screenshot.

**System prompt**
```
You are an expert at reading chat screenshots (LINE, WhatsApp, iMessage, SMS, email). Extract the full conversation text and identify any statements relevant to a rental deposit dispute. Respond only in valid JSON. No prose.
```

**User prompt** (`{screenshot_index + 1}` filled)
```
This is conversation screenshot #{n} from a Thai rental deposit dispute.

Extract all readable text and identify key statements.

Return this exact JSON:
{
  "readable": true or false,
  "platform": "LINE" or "WhatsApp" or "SMS" or "email" or "other" or "unknown",
  "language": "th" or "en" or "mixed",
  "messages": [
    {
      "sender": "landlord" or "tenant" or "unknown",
      "text": "exact message text",
      "timestamp": "date/time if visible, else null"
    }
  ],
  "landlord_promises": ["direct quote or paraphrase of any promise made by the landlord"],
  "tenant_promises": ["direct quote or paraphrase of any promise made by the tenant"],
  "deposit_mentions": ["any sentence that mentions deposit, refund, deduction, damage, repair costs"],
  "overall_tone": "cooperative" or "disputed" or "threatening" or "neutral",
  "key_date": "most relevant date mentioned, or null",
  "notes": "anything unusual, unreadable sections, or important context"
}

Rules:
- If the screenshot is unreadable or not a conversation, set readable to false and leave arrays empty
- Preserve original Thai text in the messages array — do not translate
- Classify sender as landlord/tenant based on chat bubble side or name labels when visible
- landlord_promises and tenant_promises should capture anything that could be used as evidence
```

`run_evidence_analysis` merges all per-screenshot results with tenant-typed manual promises
into a single `evidence_text` blob consumed by Agent 03.

---

## Agent 02 — Contract Parser

`agent02_contract_parser/prompts.py` — Typhoon v2, LangChain chain
`PARSER_PROMPT | llm | JsonOutputParser`.

**System prompt (Thai, verbatim)**
```
คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านสัญญาเช่าที่อยู่อาศัย
วิเคราะห์สัญญาเช่าที่ให้มาและตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

สำหรับแต่ละรายการที่เจ้าของบ้านเรียกร้อง ให้ตรวจสอบ:
1. มีข้อกำหนดในสัญญาที่ระบุความรับผิดชอบของผู้เช่าหรือไม่
2. มีการเปิดเผยความเสียหายที่มีอยู่ก่อนหรือไม่
3. ข้อสัญญาใดที่ขัดต่อประกาศ สคบ. 2568 หรือ ป.พ.พ. มาตรา 546-571
4. จำนวนเงินประกัน วันเริ่มต้น-สิ้นสุดสัญญา ระยะเวลาแจ้ง ค่าเช่ารายเดือน
```
_Gloss:_ Thai residential-lease law expert. Analyze the lease, JSON only. Per landlord claim
check: (1) contract clause assigning tenant liability, (2) pre-existing damage disclosed,
(3) clauses violating OCPB 2568 or CCC §546-571, (4) deposit amount, lease start/end, notice
period, monthly rent.

**User prompt (Thai, verbatim)** — `{lease_text}`, `{claim_list}` filled
```
สัญญาเช่า:
{lease_text}

รายการที่เจ้าของบ้านเรียกร้อง:
{claim_list}

สำคัญมาก: ค้นหาข้อสัญญาต่อไปนี้ในสัญญาและเพิ่มแต่ละข้อที่พบลงใน unfair_clauses โดยต้องอ้างอิงข้อความจากสัญญาจริง ไม่ใช่จากคำอธิบาย:
1. ข้อกำหนดให้ผู้เช่าจ่ายค่าความเสื่อมสภาพตามปกติ (wear and tear) → โมฆะตาม สคบ. 2568
2. เงินประกันเกิน 1 เดือนสำหรับผู้ให้เช่า 3 ยูนิตขึ้นไป → โมฆะตาม สคบ. 2568
3. ผู้ให้เช่าขึ้นค่าเช่าได้เองโดยไม่ต้องขอความยินยอมผู้เช่า → โมฆะตาม สคบ. 2568
4. ค่าไฟฟ้า/น้ำเกินอัตราที่การไฟฟ้า/ประปากำหนด → โมฆะตาม สคบ. 2568
หากพบข้อสัญญาที่โมฆะ ต้องใส่ใน unfair_clauses เสมอ ห้ามใส่ไว้แค่ใน notes

ตอบในรูปแบบ JSON นี้เท่านั้น:
{
  "liability_map": [
    {
      "item": "string",
      "tenant_liable": false,
      "contract_clause": "ข้อความจากสัญญา หรือ null",
      "clause_found": false,
      "pre_existing_disclosed": false,
      "notes": "string"
    }
  ],
  "contract_summary": {
    "deposit_amount_thb": 0,
    "deposit_months": 0,
    "lease_start": "YYYY-MM-DD",
    "lease_end": "YYYY-MM-DD",
    "notice_period_days": 0,
    "monthly_rent_thb": 0
  },
  "unfair_clauses": [
    {
      "clause_text": "string",
      "reason_void": "string"
    }
  ]
}
```
_Gloss of the critical instruction:_ Hunt these clauses and add each found to
`unfair_clauses`, quoting the ACTUAL contract text (not a paraphrase): (1) tenant pays normal
wear-and-tear → void per OCPB 2568; (2) deposit >1 month for 3+-unit landlord → void;
(3) landlord raises rent without tenant consent → void; (4) utility charges above the
official rate → void. Void clauses MUST go in `unfair_clauses`, never only in `notes`.

**Retry:** on JSON failure, a correction prompt ("you replied in the wrong JSON format,
reply again in valid JSON only") re-sends lease + claims.

---

## Agent 03 — Legal Reasoning (RAG)

`agent03_legal_reasoning/prompts.py` — Typhoon v2. Two prompts: per-claim reasoner + case summary.

### Reasoner

**System prompt (Thai, verbatim)**
```
คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านการเช่าที่อยู่อาศัย
ใช้บทบัญญัติกฎหมายที่ให้มาเป็นฐานในการพิจารณาเท่านั้น
ห้ามอ้างอิงกฎหมายที่ไม่ได้ให้มา ห้ามคาดเดา
คำตัดสินต้องเป็นหนึ่งใน: LAWFUL, DISPUTED, UNLAWFUL
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
```
_Gloss:_ Thai residential-tenancy law expert. Use ONLY the provided law provisions as basis.
Do NOT cite law not given. Do NOT guess. Verdict must be one of LAWFUL / DISPUTED / UNLAWFUL.
JSON only. **← the anti-hallucination guardrail: the retrieved RAG chunks are the only citable source.**

**User prompt (Thai, verbatim)** — filled with item, description, amount_thb, cv_verdict,
cv_confidence, contract_liable, movein_report_signed, forced_verdict_instruction, and
`{retrieved_chunks}` from ChromaDB
```
ข้อมูลกรณี:
- รายการ: {item}
- คำอธิบายการเรียกร้อง: {description}
- จำนวนเงิน: {amount_thb} บาท
- ผลการตรวจสอบภาพ: {cv_verdict} (ความมั่นใจ {cv_confidence})
- สัญญาระบุความรับผิดชอบผู้เช่า: {contract_liable}
- มีรายงานสภาพ ณ วันเข้าอยู่ที่เซ็นแล้ว: {movein_report_signed}
{forced_verdict_instruction}

บทบัญญัติกฎหมายที่เกี่ยวข้อง:
{retrieved_chunks}

ตอบในรูปแบบนี้:
{
  "verdict": "LAWFUL หรือ DISPUTED หรือ UNLAWFUL",
  "reasoning_th": "เหตุผล 2-3 ประโยคเป็นภาษาไทย",
  "reasoning_en": "2-3 sentence reasoning in English",
  "citations": ["ประกาศ สคบ. 2568", "ป.พ.พ. มาตรา 546"],
  "recommended_action_th": "สิ่งที่ผู้เช่าควรทำ",
  "claim_validity_pct": 0
}
```

**Forced-verdict instruction** (injected when `apply_hard_rules` fires)
```
คำตัดสินที่กำหนดไว้แล้ว: {verdict}
ห้ามเปลี่ยนคำตัดสิน ให้เขียนเฉพาะ reasoning_th, reasoning_en, citations, recommended_action_th และ claim_validity_pct เท่านั้น
```
_Gloss:_ Verdict is pre-set: {verdict}. Do NOT change it. Write only reasoning_th,
reasoning_en, citations, recommended_action_th, claim_validity_pct. The code additionally
overwrites `result["verdict"]` afterward, so the LLM cannot drift from a forced verdict.

**Hard rules** (`reasoner.py::apply_hard_rules`, run before the LLM):
`PRE_EXISTING` / `UNCHANGED` / `NORMAL_WEAR` → `UNLAWFUL`;
`NEW_DAMAGE` without a signed move-in report → `DISPUTED`;
CV confidence < 0.60 → `DISPUTED`; otherwise `None` (LLM decides freely).

### Case Summary

**System prompt (Thai, verbatim)**
```
คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านการเช่าที่อยู่อาศัย
สรุปผลการวินิจฉัยทั้งหมดเป็น JSON ที่มีสองฟิลด์: case_summary_th และ case_summary_en
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
```
_Gloss:_ Thai tenancy law expert. Summarize all verdicts as JSON with two fields
`case_summary_th` + `case_summary_en`. JSON only.

**User prompt (Thai, verbatim)** — filled with verdicts_json, total_claimed_thb,
total_unlawful_thb, routing
```
ผลการวินิจฉัยทั้งหมด:
{verdicts_json}

ยอดรวมที่เรียกร้อง: {total_claimed_thb} บาท
ยอดที่ไม่ชอบด้วยกฎหมาย: {total_unlawful_thb} บาท
เส้นทางการดำเนินคดี: {routing}

ตอบในรูปแบบนี้:
{
  "case_summary_th": "สรุปคดี 3-4 ประโยคเป็นภาษาไทย",
  "case_summary_en": "3-4 sentence case summary in English"
}
```

---

## Agent 04 — Document Generator

`agent04_doc_generator/prompts.py` — Typhoon v2, **`temperature=0.05`** (near-deterministic,
legal docs). Fills one document section per call.

**System prompt (Thai, verbatim)**
```
คุณเป็นผู้เชี่ยวชาญด้านการร่างเอกสารกฎหมายไทย
ร่างเอกสารตามโครงสร้างที่กำหนดอย่างเคร่งครัด
ใช้เฉพาะข้อมูลและกฎหมายที่ให้มา ห้ามเพิ่มเนื้อหาที่ไม่ได้ระบุ
ใช้ภาษาไทยทางการตลอด
วันที่ทุกรูปแบบต้องเป็น พ.ศ. เสมอ (ค.ศ. + 543)
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
```
_Gloss:_ Thai legal-document drafting expert. Follow the given structure strictly. Use ONLY
provided data and law — add nothing unspecified. Formal Thai throughout. ALL dates in Buddhist
Era (พ.ศ. = CE + 543). JSON only.

**User prompt (Thai, verbatim)** — filled with doc_type, section_key, instruction,
`{context_json}` (full case dict)
```
ประเภทเอกสาร: {doc_type}
ส่วน: {section_key}
คำสั่ง: {instruction}

ข้อมูลคดี:
{context_json}

ตอบในรูปแบบ JSON:
{
  "{section_key}": "ข้อความภาษาไทยทางการที่ร่างแล้ว"
}
```

**Correction prompt** (on `validate_output` failure)
```
เอกสารที่ร่างก่อนหน้านี้ไม่ผ่านการตรวจสอบ: {error_message}

กรุณาร่างใหม่ ปฏิบัติตามกฎเหล่านี้อย่างเคร่งครัด:
1. ใช้เฉพาะกฎหมายที่อยู่ใน citations ของผลการวินิจฉัยเท่านั้น
2. จำนวนเงินทุกรายการต้องตรงกับข้อมูลที่ให้มาเท่านั้น
3. วันที่ต้องเป็น พ.ศ. เสมอ

ประเภทเอกสาร: {doc_type}
ส่วน: {section_key}
คำสั่ง: {instruction}

ข้อมูลคดี:
{context_json}

ตอบเป็น JSON: {"{section_key}": "ข้อความที่แก้ไขแล้ว"}
```
_Gloss of the three rules:_ (1) use only law in the verdict `citations`; (2) every amount must
match the provided data exactly; (3) dates must be พ.ศ.

**Validation that triggers the correction** (`generator.py::validate_output`): a regex rejects
any citation (`ป.พ.พ. มาตรา N`, `สคบ.`, `พ.ร.บ.`) not in Agent 03's allowed list, and requires
every THB amount to appear verbatim. One retry, then raises `ValueError`.

---

## Cross-Agent Guardrails

| Guardrail | Where |
|---|---|
| JSON-only, low temperature | all agents |
| Regex JSON-repair / stub fallback | 01a, 01b |
| Single self-correcting retry | 02, 04 |
| Citations locked to retrieved RAG chunks | 03 |
| Deterministic hard rules override the LLM | 03 |
| Citations locked to Agent 03's list + amounts must appear verbatim | 04 |
| Dates forced to Buddhist Era (พ.ศ.) | 04 |
