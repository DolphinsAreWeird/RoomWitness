# RoomWitness

Agentic AI pipeline that helps Bangkok renters dispute unfair security-deposit deductions.
Renter uploads move-in photos, move-out photos, and the lease; the system returns 3
ready-to-file Thai legal documents (OCPB complaint, deposit demand letter, evidence
summary). BDI Bangkok Hackathon 2026. Team: KP (lead), Beam (frontend + pitch), Tuey (tech).

## Implementation Status

Audited 2026-08-08. Everything below is real (live LLM/RAG calls), not mocked, unless noted.

| Component | Status | Notes |
|---|---|---|
| express-backend (all routes) | FULL | Stateless proxy/orchestrator to the 4 agent services; no DB (by design). `/full-analysis` correctly maps agent01→02→03 outputs. |
| roomwitness-app (mobile) | FULL | Real multipart calls in `lib/api.ts`; `.env` has `EXPO_PUBLIC_USE_MOCK=false` pointing at an ngrok tunnel (likely stale — repoint before next demo). Falls back to `fixtures.ts` mocks only if `USE_MOCK` unset. |
| nextjs-frontend | FULL | Calls express-backend per-agent routes directly (not `/full-analysis`); `next.config.js` rewrites proxy to `BACKEND_URL`. |
| Agent 01 CV (`roomwitness-rag/services/agent01_service.py`) | FULL | Real Groq Llama-4-Scout vision calls comparing move-in/move-out photos. |
| Agent 02 Contract Parser (`.../services/agent02_service.py`) | FULL | Real pdfplumber extraction + Typhoon v2 (LangChain) parsing + Groq screenshot OCR for chat evidence. |
| Agent 03 Legal Reasoning (`.../services/agent03_service.py`) | FULL | Real hard-rule engine + ChromaDB RAG retrieval (corpus is seeded, ~1MB) + Typhoon v2 per-claim reasoning. |
| Agent 04 Doc Generator (`.../services/agent04_service.py`) | FULL | Real Typhoon v2 narrative generation + ReportLab/Platypus PDF rendering (Thai font) + local-disk storage + working download route. |
| `GROQ_API_KEY` / `TYPHOON_API_KEY` | SET | Real keys present in `roomwitness-rag/.env`. |
| AWS S3 (`shared/s3_client.py`, `agent0X_*/uploader.py`) | UNUSED | Placeholder creds; agents run in local-disk "demo mode" instead. Kept for future use per README. |
| `agent01_cv/main.py`, `agent02_contract_parser/main.py`, `agent03_legal_reasoning/main.py`, `agent04_doc_generator/main.py` | STUBBED/DEAD | Alternate standalone FastAPI apps for an S3-URL-based Agent01Input/Agent02Input/Agent03Input contract that does **not** match what express-backend sends. Not run by anything (README only runs `services.agentXX_service`). `agent01_cv/main.py` also has a live bug — calls `assess_claim(move_in_b64=…)` but `cv.py` defines `assess_claim(move_in_b64s: list[str], …)`. Safe to ignore or delete. |
| `roomwitness-vlm/` | DEAD | Empty except `__pycache__` — CV/evidence agents were moved into `roomwitness-rag/agent01_cv/`. Directory + all references below (and in README pipeline diagrams elsewhere) are stale. |
| `roomwitness-rag/portal/` | DEAD | Only a leftover `chroma_db/`; `portal/app.py` referenced later in this file no longer exists. |

The rest of this file (below) describes an **older architecture** (`portal/app.py`,
`rag_agent.py`, `roomwitness-vlm/agent01_cv.py`) that has since been replaced by
`roomwitness-rag/services/agentXX_service.py` + `roomwitness-rag/agent0X_*/`. Trust
`README.md`'s Quick Start and the table above over the sections below; they're kept
for historical data-contract reference only.

## 4-Agent Pipeline

1. **CV Comparison** (`roomwitness-vlm/agent01_cv.py`) — compares move-in vs move-out
   photos per landlord claim. Llama-4-Scout via Groq.
2. **Evidence Extraction** (`roomwitness-vlm/agent02_evidence.py`) — reads chat
   screenshots (LINE/WhatsApp/SMS), surfaces landlord/tenant promises. Llama-4-Scout.
3. **Legal Reasoning** (`roomwitness-rag/rag_agent.py`) — RAG over Thai law
   (CCC §537-571 + OCPB 2025) in ChromaDB, classifies each claim. Groq + local embeddings.
4. **Document Generation** — spec only, not yet built. Synthesizes the 3 Thai documents.

## Repo Map

- `roomwitness-rag/` — Groq LLM + ChromaDB RAG. `rag_agent.py` (classifier),
  `build_corpus.py` (scrape→chunk→embed), `corpus/` (CCC + OCPB text), `chroma_db/`
  (vector store), `portal/app.py` (Flask app — runs the FULL working pipeline via
  `/full-analysis`; reference UI, not the final product UI).
- `roomwitness-vlm/` — vision agents (`agent01_cv.py`, `agent02_evidence.py`).
- `pencil_design/BDI-roomwitness.pen` — product UI design (Pencil). Owner: Beam.
- `docs/room_witness_allignment.md` — full operational alignment doc.

## Data Contracts (drive the frontend)

These are the existing JSON shapes the UI renders. Do not invent fields.

**Agent 01 CV** — `run_cv_assessment()` returns `{claim_assessments[], summary, ...}`.
Each assessment:
```
{ item, move_in_condition, move_out_condition, change_detected, change_description,
  wear_and_tear, wear_and_tear_reason, likely_tenant_caused,
  supports_landlord_claim: "YES"|"NO"|"PARTIAL", confidence, confidence_reason,
  low_visibility, notes }
```
summary: `{ total_claims, supported_claims, disputed_claims, partial_claims,
low_confidence_items[], total_disputed_amount }`

**Agent 02 evidence** — `run_evidence_analysis()`:
```
{ screenshots_processed, platforms_detected[], all_landlord_promises[],
  all_tenant_promises[], all_deposit_mentions[], total_messages_extracted,
  evidence_text, screenshot_details[{overall_tone, messages[], ...}] }
```

**Agent 03 legal** — `classify_claim(claim, cv_evidence, contract_clause)`:
```
{ classification: "LAWFUL"|"DISPUTED"|"UNLAWFUL", confidence, dispute_amount,
  dimensions: { pre_existence, wear_and_tear, proportionality, contractual_clarity },
  legal_basis: [{ section, source: "CCC"|"OCPB", excerpt, favors: "TENANT"|"LANDLORD" }],
  summary_th, retrieved_sections[] }
```

**Agent 04 docs** — not built. Output: 3 Thai docs (OCPB complaint, deposit demand,
evidence summary).

## HTTP API (portal/app.py — the real frontend contract)

Product endpoint: **`POST /full-analysis`** (multipart form). Runs CV → evidence → legal
per claim.

- **Required:** `claims` — JSON array of `{item, description, amount_thb}` (≥1, else 400).
  **Claims are the only required input** — the renter types what the landlord is charging for.
- **Optional:** `move_in_image`, `move_out_image` (single each), `screenshots` (multiple),
  `contract_clause`, `manual_landlord_promises`, `manual_tenant_promises`. Photos are
  "optional but recommended".

Response:
```
{ claims: [ { claim: {item, description, amount_thb},
              cv:    {move_in_condition, move_out_condition, wear_and_tear,
                      likely_tenant_caused, low_visibility,
                      supports_landlord_claim: "YES"|"NO"|"PARTIAL", confidence, ...},
              legal: {classification, confidence, dimensions, legal_basis[], summary_th, ...} } ],
  cv_summary:       {total_claims, supported_claims, disputed_claims, partial_claims,
                     total_disputed_amount},
  evidence_summary: {landlord_promises[], tenant_promises[], deposit_mentions[], platforms[]} | null,
  images_used:      {move_in, move_out} }
```
Each claim card has TWO verdicts: `cv.supports_landlord_claim` (photo) AND
`legal.classification` (law).

Other routes: `POST /extract-contract` (file → `{text}`), `POST /extract-evidence`,
`POST /assess-damage`, `POST /analyze` (single claim, legal only), `GET /health`
(`{corpus_loaded}`).

> **The recoverable-฿ total is NOT backend-computed.** Only `cv_summary.total_disputed_amount`
> (sum of photo-disputed claims) exists; deposit/rent fields are collected in the portal but
> never sent. The "฿X of ฿Y recoverable" verdict in the design is illustrative — needs wiring.

## Run

```bash
cd roomwitness-rag
pip install -r requirements.txt
cp .env.example .env            # set GROQ_API_KEY
python build_corpus.py          # build ChromaDB (skips if already loaded)
flask --app portal/app.py run   # debug portal on :5001
python rag_agent.py             # CLI test: sample wall-paint claim

cd ../roomwitness-vlm
python agent01_cv.py move_in.jpg move_out.jpg
```

Env: `GROQ_API_KEY` (required), `CHROMA_PATH` (default `./chroma_db`),
`GROQ_MODEL` (default `llama-3.3-70b-versatile`), `EMBED_MODEL`.

## Frontend Conventions (Beam)

- Stack: Next.js 14 + Tailwind + ShadCN UI (per alignment doc).
- Bilingual TH + EN: Thai primary, English secondary line.
- Classification color tokens: `LAWFUL` = green, `DISPUTED` = amber, `UNLAWFUL` = red.
- 4-screen flow: Upload → Analyzing (pipeline) → Results (claims + damage map) →
  Documents. Design lives in `pencil_design/BDI-roomwitness.pen`.
