# RoomWitness

Agentic AI pipeline that helps Bangkok renters dispute unfair security-deposit deductions.
Renter uploads move-in photos, move-out photos, and the lease; the system returns 3
ready-to-file Thai legal documents (OCPB complaint, deposit demand letter, evidence
summary). BDI Bangkok Hackathon 2026. Team: KP (lead), Beam (frontend + pitch), Tuey (tech).

## Repo layout

- `roomwitness-rag/` — all 4 Python agents as packages, plus a bridge `services/`
  layer that's what's actually deployed (see below).
- `express-backend/` — Node/Express (TypeScript) API that proxies to the 4 Python
  services and orchestrates the mobile full-analysis flow.
- `nextjs-frontend/` — Next.js 14 App Router web demo UI (client-orchestrated).
- `roomwitness-app/` — Expo/React Native mobile app (Expo Router, Zustand, NativeWind).
- `roomwitness-vlm/` — legacy, superseded by `roomwitness-rag/agent01_cv/`. Do not add to it.
- `pencil_design/BDI-roomwitness.pen` — product UI design (Pencil). Owner: Beam.
- `docs/room_witness_allignment.md` — original operational alignment doc (historical).

The Flask `portal/app.py` referenced in older docs no longer exists — it was
replaced by `express-backend` + `nextjs-frontend` + `roomwitness-app`. See
`roomwitness-rag/docs/migrate-to-express.md` for the migration rationale.

## Two implementations per agent (02-04) — know which one you're editing

- **Package layer** (`roomwitness-rag/agentNN_*/main.py`) — production-shaped
  FastAPI apps. Agent04's package version uses S3 + ReportLab Canvas/Sarabun fonts.
  Mostly **not** what's actually running.
- **Bridge services** (`roomwitness-rag/services/agentNN_service.py`, ports
  8001-8004) — what express-backend/nextjs-frontend/roomwitness-app actually call.
  They reimplement logic independently rather than fully reusing the package layer;
  some import package internals (Agent01 fully; Agent02's `parse_contract`;
  Agent03's retriever/reasoner/router/prompts), Agent04 shares nothing with its
  package counterpart.
- Agent04's bridge service saves PDFs to **local disk**
  (`roomwitness-rag/outputs/{case_id}/`), not S3.
  `agent04_doc_generator/uploader.py` (S3) is explicitly "kept for future use, not
  called by the bridge service" per `roomwitness-rag/README.md`.

## 4-Agent Pipeline (bridge services — the ones actually running)

1. **Agent 01 — CV Damage Assessment** (`services/agent01_service.py`, port 8001).
   Groq `meta-llama/llama-4-scout-17b-16e-instruct` (vision). Compares move-in vs
   move-out photos per claim, and separately OCRs chat screenshots
   (LINE/WhatsApp/SMS) for landlord/tenant promises. Calls into
   `agent01_cv/__init__.py`'s `run_cv_assessment()` / `run_evidence_analysis()`.
2. **Agent 02 — Contract Parser** (`services/agent02_service.py`, port 8002).
   Own pdfplumber text extraction (not the package's PyMuPDF/Tesseract pipeline),
   then Typhoon v2 via `agent02_contract_parser.parser.parse_contract()`. Also
   calls `agent01_cv.run_evidence_analysis` internally for any screenshots
   submitted alongside the contract. Checks tenant liability clauses and 4
   void-clause patterns under OCPB 2568.
3. **Agent 03 — Legal Reasoning** (`services/agent03_service.py`, port 8003).
   RAG over Thai law (CCC §537-571 + OCPB 2025) in ChromaDB (`thai_rental_law`
   collection, built-in onnxruntime embeddings), Typhoon v2 LLM. Applies
   deterministic hard rules before the LLM call, then routes to OCPB vs. civil
   court based on landlord unit count.
4. **Agent 04 — Document Generation** (`services/agent04_service.py`, port 8004).
   ReportLab Platypus + Typhoon v2, generates the 3 Thai docs, saves PDFs locally
   (not S3). **Known issue**: Thai font path is Windows-only
   (`C:\Windows\Fonts\leelawad.ttf`), falls back to Helvetica elsewhere — Thai
   text likely won't render correctly off Windows.

### Agent 01 — CV (`roomwitness-rag/agent01_cv/`)

`cv.py::assess_claim(move_in_b64s, move_out_b64s, claim_item, claim_description,
claim_amount, client)` sends all move-in/move-out images + one claim per call
(temp 0.1), returns:
```
{ item, move_in_condition, move_out_condition, change_detected, change_description,
  wear_and_tear, wear_and_tear_reason, likely_tenant_caused,
  supports_landlord_claim: "YES"|"NO"|"PARTIAL", confidence, confidence_reason,
  low_visibility, notes }
```
`models.py`'s `translate_to_cv_result()` maps this deterministically to
`CVVerdict = PRE_EXISTING|UNCHANGED|NORMAL_WEAR|NEW_DAMAGE` (confidence<0.30 →
`status=unverifiable_by_cv`; `change_detected=False` → `UNCHANGED`;
`wear_and_tear=True` → `NORMAL_WEAR`; `change_detected & !likely_tenant_caused` →
`PRE_EXISTING`; `change_detected & likely_tenant_caused` → `NEW_DAMAGE`).

`evidence.py::run_evidence_analysis(screenshot_paths, manual_landlord_promises,
manual_tenant_promises, client)` →
```
{ screenshots_processed, screenshots_unreadable, platforms_detected[],
  screenshot_details[], all_landlord_promises[], all_tenant_promises[],
  all_deposit_mentions[], total_messages_extracted, evidence_text, model_used }
```

Bridge service (`services/agent01_service.py`) response:
`{damage_map: [{claim_id, item, verdict, confidence, move_in_condition,
move_out_condition, status, supports_landlord_claim, wear_and_tear,
wear_and_tear_reason, notes}], model_used}`. No photos → stub entries with
`status="unverifiable_by_cv"`, no Groq call.

*Note: `agent01_cv/main.py`'s FastAPI JSON route is broken (wrong kwarg names
into `assess_claim`) — unused, don't treat it as the reference implementation.*

### Agent 02 — Contract Parser (`roomwitness-rag/agent02_contract_parser/`)

Replaces the old "chat screenshot evidence" concept — that's now fully in Agent 01.
`models.py`'s `Agent02Output`: `{case_id, liability_map: [LiabilityItem],
contract_summary, unfair_clauses: [UnfairClause], ocr_used, extraction_confidence}`.
`LiabilityItem{item, tenant_liable, contract_clause, clause_found,
pre_existing_disclosed, notes}`.

Bridge service (`services/agent02_service.py`) response:
`{pdf_filename, liability_map[], contract_summary{}, unfair_clauses[], ocr_used,
extraction_confidence, landlord_promises[], tenant_promises[], deposit_mentions[],
platforms[]}` (last four fields are Agent01's chat-evidence output, merged in here).

### Agent 03 — Legal Reasoning (`roomwitness-rag/agent03_legal_reasoning/`)

`router.py::determine_routing(landlord_unit_count)`: `>=3` units → `route="OCPB"`,
docs `[ocpb_complaint, demand_letter, evidence_summary]`; 1-2 units →
`route="CIVIL"`, docs `[demand_letter, evidence_summary]`; unknown (0) →
`route="BOTH"`, all 3.

`reasoner.py::apply_hard_rules(cv_verdict, cv_confidence, contract_liable,
movein_report_signed)` — deterministic pre-LLM overrides: `PRE_EXISTING` →
`UNLAWFUL`; `UNCHANGED` → `UNLAWFUL`; `NORMAL_WEAR` → `UNLAWFUL`; `NEW_DAMAGE` +
unsigned move-in report → `DISPUTED`; confidence<0.60 → `DISPUTED`;
`unverifiable_by_cv` → `None` (LLM decides). The bridge service adds one more rule
not in the package: `NEW_DAMAGE + has_void_clause` → `DISPUTED`.

`models.py`'s `Agent03Output`: `{case_id, routing, documents_to_generate[],
total_claimed_thb, total_unlawful_thb, verdicts: [ClaimVerdict], case_summary_th,
case_summary_en}`. `ClaimVerdict{claim_id, item, amount_thb,
verdict: "LAWFUL"|"DISPUTED"|"UNLAWFUL", reasoning_th, reasoning_en, citations[],
recommended_action_th, claim_validity_pct}`.

*Note: bridge service hardcodes `contract_liable`/`movein_report_signed = False`
(never wired to real Agent02 output) and builds its own Typhoon client from raw
env vars instead of `shared/typhoon_client.py`.*

### Agent 04 — Document Generation (`roomwitness-rag/agent04_doc_generator/`)

Fully implemented in the package (7/6/4-section Thai templates for
ocpb_complaint/demand_letter/evidence_summary, ReportLab Canvas + Sarabun fonts,
S3 upload) — but the bridge service (`services/agent04_service.py`) shares none of
this code. It uses ReportLab Platypus, 3-4 narrative LLM sections per doc, saves
PDFs locally, generates its own `case_id` (ignores any case_id passed in). Response:
`{case_id, documents: {doc_type: {doc_type, pages, status,
download_url: "/api/v1/download/{case_id}/{doc_type}"}}, generation_time_seconds,
total_unlawful_amount_thb}`.

## HTTP API — `express-backend` (the real frontend contract, port 3001 default)

Proxies to the 4 Python bridge services (`AGENT_01_URL`..`AGENT_04_URL`, default
`localhost:8001`..`8004`).

- `GET /health` — `{status, corpus_loaded}` (pings Agent03).
- `POST /run/agent01` (multipart `move_in[]`/`move_out[]`) → Agent01 proxy.
- `POST /run/agent02` (multipart `contract_file`/`screenshots[]`) → Agent02 proxy.
- `POST /run/agent03` (JSON) → Agent03 proxy.
- `POST /run/agent04` (JSON) → Agent04 proxy.
- `POST /generate-documents` (JSON) — same as `/run/agent04` but rewrites
  `download_url` to an absolute proxy URL.
- `GET /download/:caseId/:docType` — streams the PDF through from Agent04.
- `POST /extract-contract` (multipart, PDF only via `pdf-parse`) → `{text}`.
- **`POST /full-analysis`** (multipart) — the mobile app's main orchestration
  endpoint. Chains Agent01 → Agent02 → Agent03 in one request (does **not** call
  Agent04 — doc generation is a separate `/generate-documents` call).
  - Required: `claims` — JSON array of `{item, description, amount_thb}` (≥1, else 400).
  - Optional: `move_in_image`, `move_out_image` (multi), `screenshots` (multi),
    `contract_clause`, `manual_landlord_promises`, `manual_tenant_promises`,
    `lease_start`, `lease_end`, `deposit_amount`, `monthly_rent`,
    `landlord_unit_count`.
  - Response:
    ```
    { claims: [ { claim: {item, description, amount_thb},
                  cv: {...} | null,
                  legal: {classification, confidence, dimensions, legal_basis[], summary_th, ...} } ],
      cv_summary, evidence_summary: null,   // always null — never populated in this flow
      images_used, contract_summary, unfair_clauses, pdf_filename,
      landlord_promises[], tenant_promises[], deposit_mentions[], platforms[],
      total_claimed_thb, total_unlawful_thb, routing, case_summary_th, case_summary_en }
    ```
  - Each claim card has TWO verdicts: `cv.supports_landlord_claim` (photo) AND
    `legal.classification` (law).

## Run

```bash
# Python agents (bridge services — the ones actually used)
cd roomwitness-rag
pip install -r requirements.txt
cp .env.example .env            # set GROQ_API_KEY, TYPHOON_API_KEY (required)
python agent03_legal_reasoning/seed_corpus.py   # build ChromaDB (skips if already loaded)
uvicorn services.agent01_service:app --port 8001
uvicorn services.agent02_service:app --port 8002
uvicorn services.agent03_service:app --port 8003
uvicorn services.agent04_service:app --port 8004

# Express backend (proxies to the 4 services above)
cd ../express-backend
npm install && npm run dev      # default port 3001

# Next.js web demo (proxies to express-backend via BACKEND_URL)
cd ../nextjs-frontend
npm install && npm run dev

# Expo mobile app
cd ../roomwitness-app
npm install && npx expo start   # EXPO_PUBLIC_API_BASE must point at express-backend (:3001)
```

Env (`roomwitness-rag/shared/config.py`): `GROQ_API_KEY` (optional, Agent01
vision only), `TYPHOON_API_KEY` (**required** — raises at import time if unset,
register at https://typhoon.apps.opentyphoon.ai), `TYPHOON_BASE_URL` (default
`https://api.opentyphoon.ai/v1`), `TYPHOON_MODEL` (default
`typhoon-v2-70b-instruct`; README recommends `typhoon-v2.5-30b-a3b-instruct`
instead), `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`S3_BUCKET`
(dormant — bridge services don't use S3), `CHROMA_PERSIST_DIR` (default
`./chroma_db`).

## Frontend Conventions (Beam)

- Web: Next.js 14 + Tailwind. Mobile: Expo Router + NativeWind + Zustand.
- Bilingual TH + EN: Thai primary, English secondary line.
- Classification color tokens: `LAWFUL` = green, `DISPUTED` = amber, `UNLAWFUL` = red.
- Mobile screen flow: `new-case` → `analyzing` → `results` → `details` →
  `documents`, plus a `(tabs)` root of `index`/`history`/`profile`. Design lives in
  `pencil_design/BDI-roomwitness.pen`.

## Known inconsistencies (fix opportunistically, don't assume they're intentional)

1. `roomwitness-app`'s default `API_BASE` (`:5001`) doesn't match
   `express-backend`'s default port (`:3001`) — must set `EXPO_PUBLIC_API_BASE`
   explicitly or requests silently go nowhere.
2. Agent04 package (S3) vs. bridge service (local disk) — two incompatible
   storage strategies; only local-disk is live.
3. Agent04 bridge's Leelawadee font path is Windows-only; Thai PDF text likely
   renders as Helvetica/mojibake on non-Windows dev machines.
4. `roomwitness-app`'s doc-gen types mirror the **package's** `Agent04Output`
   shape (`s3_url`, `page_count`, `generated_at`), not the bridge's actual
   response (`pages`, no `s3_url`/`generated_at`).
5. `TYPHOON_MODEL` default in `shared/config.py` doesn't match README's
   recommended model.
6. `agent01_cv/main.py`'s FastAPI JSON route is broken (wrong kwargs) — don't use
   it as a reference.
7. `express-backend`'s `/full-analysis` always returns `evidence_summary: null`
   even when screenshots were processed via Agent02 — the data exists
   (`landlord_promises`/`tenant_promises`/etc. at the top level) but isn't
   assembled into `evidence_summary`.
