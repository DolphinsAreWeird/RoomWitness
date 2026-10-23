# Hand-off for Tuey: RoomWitness on AWS for NTT

**From Beam · 23 Oct 2026 · Deadline: Sat 25 Oct 23:59.** AWS accounts close the same day. We aim to submit **Fri 24 Oct evening**.

Read this top to bottom once. Then work **in P0 order** and skip anything that isn't on the list.

---

## 1. The idea (locked, no more changes)

- **What it is:** an AI agent that checks every deposit deduction against Thai law. The tenant uploads photos, the lease and the landlord's charges. The agents compare the photos, read the lease, check each charge against the law (RAG over the Civil Code s.537-571 and the OCPB notification of 6 Jun 2025), and draft documents ready to file.
- **Who uses it:** tenants, mainly students and foreign students (KP's story). Free.
- **Who pays (on slides only):** property-management apps license the law check. **We do not build this part.**
- **Demo = the tenant flow only.** That is what we already have.
- **NTT rule:** all AI must run on **Amazon Bedrock**. Groq and Typhoon are not allowed. Hosting must be on AWS, in **us-east-1, ap-southeast-1 or ap-southeast-7** only.
- **Leftover credit is scored** (cap $350). Use cheap models, keep test runs small, and stop anything idle.

The mentor said we are ahead. Let's not waste it: a small, solid demo beats a big, broken one.

---

## 2. What judges must see in the demo (NTT criteria to features)

| Criterion | What must be on screen or in the repo |
|---|---|
| Agentic behavior | A **visible plan**: the steps the agent took, which tool/agent ran, which law sections were retrieved, and the result of each step |
| Prototype completeness | Runs end to end **on AWS** with the sample inputs. Judge test steps written. Backup video |
| Responsible AI | **Tenant approves** before documents are generated. **Escalation** when confidence is low. **Disclaimer**. **Audit log** for each case |
| Business value | **Cost per case** logged in dollars, to prove cost efficiency |

---

## 3. Current code state (what I found, 23 Oct)

- **Demo backend:** `roomwitness-rag/portal/app.py` (Flask). `POST /full-analysis` runs CV, then evidence, then legal for each claim. The response shape is documented in `RoomWitness/CLAUDE.md`.
- **Model calls to replace:**
  - Agent 01 CV and the evidence reader (`agent01_cv/cv.py`, `evidence.py`, `main.py`) use **Groq Llama-4-Scout (vision)** through the `groq` SDK.
  - Agent 02 contract parser, Agent 03 legal reasoner and Agent 04 doc generator use **Typhoon v2** through LangChain `ChatOpenAI` (`shared/typhoon_client.py`).
  - Embeddings come from local `sentence-transformers` into ChromaDB. **Keep them as they are** (no model API involved, nothing to re-embed).
- **Agent 04 (doc generator)** exists in `agent04_doc_generator/` but **is not wired into `portal/app.py`**.
- `boto3` is not in `requirements.txt`. S3 is used through `shared/s3_client.py`.
- `roomwitness-rag/.env.example` line 5 holds what looks like a **real Typhoon key**. Replace it with a placeholder, because judges may read the repo.
- The Expo app (`roomwitness-app/`) defaults to mock mode. For the live demo set `EXPO_PUBLIC_USE_MOCK=false` and point `API_BASE` at the AWS URL.

---

## 4. Work list

### P0: must have by Fri 24 Oct

**A. Move all model calls to Bedrock (about half a day)**
1. In the Bedrock console (your chosen region), open **Model access** and check which models are enabled.
   - Pick **one vision-capable model** (a Claude or Llama 4 model, whichever is enabled) for the photo and screenshot agents.
   - It can also handle the Thai text tasks. Using one model means one client and fewer surprises.
   - Prefer the **smallest model that gives acceptable Thai output**, because cost is scored.
2. Add `boto3` and `langchain-aws` to `requirements.txt`.
3. **Text agents (02, 03, 04):** in `shared/typhoon_client.py`, return a `ChatBedrockConverse(model=..., region_name=..., temperature=...)` instead of `ChatOpenAI`. The existing `PROMPT | llm | JsonOutputParser()` chains should work unchanged. Rename the file or function later if there's time.
4. **Vision agents (01 CV, evidence):** swap the `groq` client for `boto3.client("bedrock-runtime").converse(...)`. Send the images as `{"image": {"format": "jpeg", "bytes": ...}}` content blocks. Keep the same prompts and the same JSON parsing.
5. Read `response["usage"]` (input and output tokens) on every call. That feeds the cost log in step E.
6. Remove `GROQ_API_KEY` and `TYPHOON_API_KEY` from the code path. Use the instance role for Bedrock and S3 (no keys in `.env`).

**B. Deploy on AWS (about 2 hours). Pick the fastest path you trust.**
- **Fastest:** one small EC2 instance (t3.small or t3.medium) in the region, with a public IP and the security group open only on the app port.
  - Run Flask with gunicorn. Attach an IAM role with Bedrock invoke and S3 permissions.
  - **Stop it when not testing.**
  - Do not create a NAT gateway, load balancer, multi-AZ setup or RDS. The NTT deck lists these as things to avoid.
- Serverless is fine only if you already know it works. Don't start learning it now.
- Set an **AWS Budget alarm** (for example at $50) if it isn't set already, and screenshot Cost Explorer for the submission.

**C. Visible plan and escalation (about 2 hours)**
- In `/full-analysis`, build a `plan` array as the pipeline runs:
  `[{step, agent, action, input_summary, result_summary, retrieved_sections?, duration_ms}]`
  Return it in the response.
- Add an `escalation` object when any claim has `legal.confidence` below a threshold (start at 0.6), `cv.low_visibility` is true, or the classification is `DISPUTED`:
  `{needed: true, reason, message_th, contacts: ["สคบ. 1166", "สภาองค์กรของผู้บริโภค 1502"]}`
- Beam renders both in the app: the plan on the Analyzing and Results screens, and the escalation as a banner. **Send Beam the exact JSON shape as soon as it's fixed.**

**D. Human approval and documents (about 2 hours)**
- Add a `POST /generate-documents` endpoint. It takes the analysis result plus `approved_by_tenant: true` and calls Agent 04.
  - If approval is missing, return 400. That is our "human approves before anything is generated" proof.
- If Agent 04 is too broken to fix in time, generate **only the demand letter** and say so in the test steps.
- Demand-letter wording: the 7-day demand is fine. The legal facts to keep straight are below:
  - The return deadline is **7 days with no deduction and 14 days with a deduction**.
  - The cap is **3 months of advance rent plus deposit combined**.
  - Licensed dorms fall under the Dorm Act, not the OCPB notification.

**E. Audit log and cost per case (about 1 hour)**
- For each case, write one JSON file to S3 at `audit/{case_id}.json`. It holds:
  - the timestamp
  - input file keys (not the images themselves)
  - the claims
  - the model ID and region
  - the plan
  - retrieved law sections per claim
  - the verdicts and confidence
  - the escalation
  - the approval timestamp
  - **tokens and cost in USD** (tokens × the model's on-demand price)
- Return `case_id` and `cost_usd` in the response, so the app can show "Cost of this case: $0.00x".

**F. Disclaimer**
- One line in the API response and at the bottom of every document:
  "ข้อมูลนี้ไม่ใช่คำปรึกษาทางกฎหมาย ผู้ใช้ควรตรวจสอบก่อนยื่น" (not legal advice; check before filing).
- Beam adds it to the app.

**G. Judge test steps and backup (Fri)**
- A `README_NTT.md` in the repo root containing:
  - the URL
  - how to run the app or call the API
  - the sample inputs: the lease `ntt/05_demo_inputs/RoomWitness_TestContract_Phimjai.pdf` plus 2 move-in/move-out photo pairs and 2-3 claims
  - the expected output
  - what is mock and what is real
  - the region, model and cost per case
- Record a **3-minute screen video** of the full flow on AWS, in case the accounts are frozen before judging.

### P1: only if P0 is done
- Approve button in the app before document generation (Beam).
- Show the retrieved law excerpt next to each verdict.
- Privacy note: what we store (photos in S3, audit JSON), and that we delete after X days.

### P2: do NOT do now
- Landlord or partner-app API (slides only).
- Dorm Act rule set, multilingual UI, DynamoDB, auth, fine-tuning.

---

## 5. Timeline

| When | Tuey | Beam |
|---|---|---|
| **Thu 23 night** | A: switch to Bedrock and get `/full-analysis` working locally. Rotate the key | App: plan and escalation UI using a mocked JSON shape |
| **Fri 24 morning** | B: deploy on AWS. C: plan and escalation. E: audit and cost log | Connect the app to the AWS URL |
| **Fri 24 afternoon** | D: approval endpoint and documents. F: disclaimer. G: README_NTT | Slides, screenshots, record the video |
| **Fri 24 evening** | Full run with the sample inputs, fix blockers | **Submit** |
| **Sat 25** | Buffer only. Stop the EC2 instance after submitting | Buffer |

**Send Beam a message when:** (1) Bedrock works locally, (2) the AWS URL is live, (3) the JSON shapes for `plan`, `escalation`, `case_id` and `cost_usd` are final.

---

## 6. Open questions for Tuey (reply in chat)
1. Which region and which Bedrock model are enabled in our account?
2. What's already set up on AWS, and how much credit have we spent so far?
3. Is Agent 04 runnable at all, or should we do the demand letter only?
