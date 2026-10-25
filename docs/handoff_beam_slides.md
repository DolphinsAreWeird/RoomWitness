# RoomWitness — Slide Content Handoff

For the Project Presentation (PDF), required by NTT DATA Digital Innovation Challenge 2026,
due **Oct 25, 2026, 23:59 GMT+7**. Six required sections below, each with the real content —
copy, trim, and design as needed. Live links included so you don't have to re-derive anything.

**Live demo URL (use this, not the old one):** https://d2j3gmi6ttscot.cloudfront.net/app

---

## 1. Project Name

**RoomWitness** — AI-assisted security-deposit dispute platform for Bangkok renters.

One-liner: *An agentic AI pipeline that helps renters dispute unfair security-deposit
deductions — upload photos and a lease, get three ready-to-file Thai legal documents in
minutes.*

---

## 2. Use Case / Pain Point

Bangkok renters routinely lose part or all of their security deposit to landlords who cite
vague "damage" or invoke void wear-and-tear clauses — most tenants lack the legal knowledge,
Thai-language document skills, or time to formally dispute it. Building a credible dispute
today means manually comparing photos, parsing a lease, researching Thai tenancy law (Civil
and Commercial Code §537–571, OCPB 2025/2568 regulations), and drafting multiple formal
documents — a multi-day task most renters simply give up on, so landlords keep the deposit
by default.

**Persona:** Nira, 27, works in digital marketing, rented a 1-bedroom Bangkok condo for 2
years. At move-out the landlord deducts 60% of her deposit citing "wall damage" and "worn
flooring" — no itemization, no photos, no clause reference. She has move-in photos on her
phone but no legal knowledge, no time or budget for a lawyer, and no idea how to formally
dispute it. Most renters in her position simply give up.

**Workflow diagram (persona-driven swimlane):** https://claude.ai/artifact/HveVZcUTvJrejFQH4S6q2h

---

## 3. AWS Solution

RoomWitness runs as a 4-agent pipeline behind a web app:

- **Agent 01 (CV):** compares move-in vs. move-out photos per landlord claim, returns a
  verdict + confidence score
- **Agent 02 (Contract Parser):** OCR + structured extraction of the lease, plus
  chat-screenshot evidence
- **Agent 03 (Legal Reasoning):** hard-rule engine + RAG over a Thai tenancy-law corpus
  (ChromaDB — CCC §537–571 + OCPB 2025), classifies each claim as lawful / disputed / unlawful
- **Agent 04 (Document Generator):** synthesizes and renders the final Thai-language PDFs,
  gated on explicit tenant approval

All 4 agents run on **Amazon Bedrock** — Amazon Nova (`apac.amazon.nova-lite-v1:0`), both
text and vision, confirmed working live. (Anthropic models on Bedrock are blocked for this
account by an AWS Marketplace subscription permission gap, not something fixable from our
side — Nova is the fully-native, compliant path.)

**Responsible AI (judging criterion 4):**
- Disclaimer on every generated document and the results page ("AI-assisted guidance, not
  formal legal advice")
- Escalation flow: low-confidence or complex cases point to the OCPB hotline (1166) or a
  lawyer
- Explicit tenant approval required before any document is generated (enforced
  server-side — the API itself rejects the request without it, not just a UI gate)
- Per-case audit trail: every case writes a JSON record (inputs, cited law, verdict) to a
  private S3 bucket, 90-day retention
- Privacy note shown upfront: what's kept, for how long, never shared with third parties

---

## 4. AWS Architecture Diagram & Services Used

**Full interactive diagram + writeup:** https://claude.ai/artifact/5xEG9EDkm7jTQd6xcrQ3kb

| Service | Role |
|---|---|
| Amazon ECS (Fargate) | Hosts all 6 containerized services (4 agents, Express gateway, Next.js frontend) |
| Amazon Bedrock | LLM/VLM backend for all 4 agents — Amazon Nova, text + vision |
| Amazon CloudFront | Public HTTPS entry point (no domain owned — CloudFront's own managed cert) |
| Application Load Balancer | Origin behind CloudFront, locked to CloudFront-only ingress |
| AWS Cloud Map | Private DNS service discovery between internal services |
| Amazon S3 | Per-case audit trail (JSON records), 90-day lifecycle expiration |
| Amazon ECR | Container image registry (3 repositories) |
| Amazon CloudWatch Logs | Centralized logging, 7-day retention |
| AWS IAM | Scoped task roles (Bedrock access for agent tasks, none for the web tier) |
| AWS Systems Manager Parameter Store | Secrets injection into ECS tasks |
| Amazon VPC | Default VPC, public subnets — no NAT gateway, cost-optimized for demo scale |

---

## 5. AWS Pricing Estimation

**Live AWS Pricing Calculator estimate:** https://calculator.aws/#/estimate?id=b117158b4460aa8edc409af19ae5109150336ce7

Modeled on the deployed footprint: 4 agent tasks (0.5 vCPU / 1 GB each) + 2 web tasks
(0.25 vCPU / 0.5 GB each) running continuously on Fargate, plus one Application Load
Balancer, in ap-southeast-1.

**Actual observed spend:** ~$32 of the $350 team budget as of Oct 24 (check AWS Cost
Explorer for the exact current figure before the deadline — it updates daily). ECS Fargate
compute is the dominant cost (~85-90%); Bedrock itself is pay-per-request and barely
registers at demo volume. No NAT gateway keeps the baseline low, and cost drops to near-zero
by scaling services to 0 outside active demo/testing windows.

---

## 6. Before vs. After Improvement

| | Before RoomWitness | After RoomWitness |
|---|---|---|
| Time to file a dispute | Days, often never attempted | Minutes — one upload flow |
| Legal knowledge required | Renter must research CCC §537–571 and OCPB rules themselves | AI cites the exact statutes and clauses automatically |
| Evidence organization | Manual photo comparison, no structured record | AI-generated photo-by-claim comparison with confidence scores |
| Documents produced | None — most renters give up | 3 ready-to-file Thai documents: OCPB complaint, deposit demand letter, evidence summary |
| Typical outcome | Landlord keeps the deposit by default | Renter has a complete, law-grounded case ready to submit |

---

## Reference

- Judge test steps + sample inputs: `docs/JUDGE_TEST_STEPS.md` (update the Bedrock/Nova
  mention — it currently says Groq/Gemini, now stale since we switched to real Bedrock)
- Official NTT requirements notes: `docs/NTT_official_requirements.md`
- Full editable submission doc (same content as this file, already in Docs format):
  https://claude.ai/artifact/VVip5GK3ajnZ6VVH7Z9vuE
