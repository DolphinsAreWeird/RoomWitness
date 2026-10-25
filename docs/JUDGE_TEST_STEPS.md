# RoomWitness — Judge Test Steps

Live prototype: http://roomwitness-alb-1310860742.ap-southeast-1.elb.amazonaws.com/app

## Sample inputs

Use the fixtures in `data/` at the repo root — no account, no real tenant data:

| File | Use for |
|---|---|
| `sofa-before.png` | Move-in photo |
| `sofa-after.png` | Move-out photo |
| `RoomWitness_TestContract_Phimjai.pdf` | Lease contract upload |

## Steps

1. Open the live URL above.
2. **Claims** — add one claim: item `Sofa`, description `Large stain on fabric`, amount `3000` THB.
3. **Photos** — upload `sofa-before.png` as move-in, `sofa-after.png` as move-out.
4. **Extras** — upload `RoomWitness_TestContract_Phimjai.pdf` as the contract. Optionally fill deposit (`15000`) and monthly rent (`8000`).
5. **Review** — confirm and run.

## What you should see

- **Step 1 (CV):** a verdict on the sofa claim with a confidence score, comparing the two photos.
- **Step 2 (Contract):** the lease parsed — deposit amount, lease dates, and any clauses flagged as void under Thai tenancy law (OCPB 2568 / CCC §562).
- **Step 3 (Legal):** a per-claim verdict (LAWFUL / DISPUTED / UNLAWFUL) with Thai + English reasoning and real statute citations.
- **Step 4 (Docs):** three downloadable Thai-language PDFs — OCPB complaint, deposit demand letter, evidence summary. Each carries a disclaimer and an escalation note (OCPB hotline 1166 / lawyer referral).

A disclaimer banner and privacy note are visible in the UI at the claims step and throughout the results page (Responsible AI / safety).

## Optional: the landlord side of the same check

The same four agents also serve landlords and property businesses. Only the framing and the final output change; nothing extra runs on AWS.

1. Open the live URL with `?role=landlord` (individual landlord, 1–2 rooms) or `?role=business` (apartments, dorms, property managers, 3+ units), or pick the role at the top of the Claims step.
2. Repeat steps 2–5 above. On Extras, the rental-units field is pre-filled (1 for a landlord, 3 for a business) and you can add a room number.
3. On the results, each deduction shows the owner's next step and an **Include in the statement** checkbox: Lawful items start included, Disputed ones are your call, Unlawful ones can't be included.
4. **Approve** issues a printable **deduction statement** (item, check result, cited law, amount, refund due to the tenant) instead of the tenant's Thai filings. Agent 04 is not called on this path.

## Fallback if AWS is unavailable

Known risk: NTT shuts down team AWS accounts after the submission deadline. If the live URL above is down when you test:

1. Clone the repo, `cd roomwitness-rag`, `pip install -r requirements.txt`.
2. `copy .env.example .env` and set an LLM/VLM key (Groq or Gemini — see `shared/typhoon_client.py` for supported providers).
3. From the repo root: `start-all.bat` (starts all 6 services locally).
4. Open `http://localhost:3000/app` and repeat the steps above.

A screen recording of a full run is also provided alongside the submission as a backup in case neither path is testable live.

## Architecture & cost reference

- Architecture diagram + full technical writeup: https://claude.ai/artifact/5xEG9EDkm7jTQd6xcrQ3kb
- AWS Pricing Calculator estimate: https://calculator.aws/#/estimate?id=b117158b4460aa8edc409af19ae5109150336ce7
- Actual observed spend (first ~5 days live): $28.40 of the $350 budget.
