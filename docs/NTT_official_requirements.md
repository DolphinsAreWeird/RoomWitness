# NTT DATA Digital Innovation Challenge 2026: official requirements

**Sources, in order of trust:**
1. **NTT's own workshop deck** (`Digital Innovation Challenge- Student Workshop.pptx`, 19 slides). Written, so reliable. It has the **official judging criteria slide** (slide 10), the timeline, the AWS access rules and the cost rules.
2. The two **workshop recordings** (Day 1, 28 Sep, and Day 2, 29 Sep 2026), where NTT DATA Thailand staff and AWS Thailand explained the rules out loud. Noisy Thai speech-to-text, so I marked uncertain parts **GARBLED**.
3. The mentor meeting of 15 Oct. Useful but the most garbled.

Also in your download: `NTTWorkshopDeck.zip` holds five AWS training PDFs (AWS Intro, IAM, Serverless, Amazon Quick, AI-DLC). That is teaching material, not rules, and I did not read it in depth.

**This file replaces the guesses in my earlier notes.** The corrections are in section 8.

Who spoke: Watchanun ("Pi New") and Panita ("Pi Eung") from NTT DATA Thailand People and Culture, who run the program. Thanadet ("Pi Gek") from NTT DATA's cloud and security support team, who set up the AWS accounts. Santiphap Satthaporn from AWS Thailand (Partner Solutions Architect), who taught.

---

## 1. Dates (the urgent part)

| Date | What | Source |
|---|---|---|
| 28-29 Sep | Workshops: serverless patterns, Amazon Quick, Kiro | deck |
| By 2 Oct | Each team gets its own AWS account and a coach, by email | deck, staff |
| **25 Oct 2026, 23:59** | **Prototype submission deadline.** The deck's latest timeline says 25 Oct. An older slide in the same deck still says 23 Oct, which was the original date. Staff advise submitting 10-15 minutes early. | deck, staff |
| 25 Oct | Staff said they **shut down the AWS accounts** and record each team's spend | staff (verbal) |
| Before 20 Nov | The top 8 of 24 teams are announced, 1-2 weeks ahead | staff |
| **20 Nov 2026** | **Final pitch** with a project demonstration, in person at the NTT DATA building, One Bangkok | deck, staff |
| **24 Nov** | **NTT DATA Ignite 2026**: awards, a showcase booth for the top 3, a chance to meet industry leaders and potential business partners | deck |

The build phase in the deck lists: prototype development, solution validation, **business case preparation**, coaching and reviews. Today is 15 Oct, so you have **10 days**.

---

## 2. The official judging criteria (deck slide 10)

Six criteria. **The slide gives no weights**, and staff said they would not share them. Each one comes with "what it means" and "evidence to look for":

| # | Criterion | What it means | Evidence they look for |
|---|---|---|---|
| 1 | **Problem clarity** | The team clearly explains who has the problem and why it matters. | Problem statement, **user persona**, simple **workflow**. |
| 2 | **Agentic behavior** | The agent plans steps, uses data and tools, reasons across information, and produces an action or recommendation. | **Visible task plan**, a tool or mock API call, a **RAG result**, and the final output. *Solution expectation: RAG with custom chunking, a use-case LLM, and an agentic agent.* |
| 3 | **Prototype completeness** | The demo works end to end using realistic mock or synthetic data. | **Live demo**, sample inputs, generated outputs, basic UI. *Final deployment: use AWS and demonstrate cost efficiency.* |
| 4 | **Responsible AI and safety** | The team shows **human approval**, privacy awareness, and safe boundaries. | **Guardrails, escalation flow, disclaimers, and an audit trail.** |
| 5 | **Creativity and user experience** | Easy to understand, useful, and engaging for the target user. | Clear UX, storytelling, practical workflow. |
| 6 | **Business or social value** | A measurable benefit such as time saved, better access, reduced risk, or improved service. | A benefit statement and a simple metric or **before-after comparison**. *Optional: a relevant benchmark or threshold.* |

Staff also said the prototype should be an **agentic AI** built from the **idea you submitted in round 1**. If you submitted two ideas, build the first. The submission format is **not announced yet**; NTT will email it.

---

## 3. Money and cost: this is scored

- **$350 is a strict cap per team**, equal for all (deck slide 14, staff). The mentor's "$250" on 15 Oct is unexplained. It may be a slip, or what you had left.
- **Leftover credit is scored.** Staff said that among teams, whoever develops the prototype and has the most credit left gets better marks (staff, CLEAR). The organizers watch each team's spend live on an **observer dashboard** (deck slide 15), and take a spend snapshot on 25 Oct. The credit runs from when your account was issued, so **anything you have already spent counts.**
- **Alerts by email (deck slide 15):** 50% ($175) advisory, 80% ($280) warning, 90% ($315) critical, **100% ($350) exhausted and the account is frozen.** Check spend in **Cost Explorer** and **AWS Budgets**.
- **Plan before you build (deck slide 14):** model the architecture at **calculator.aws**, set the calculator region to ap-southeast-1 or your chosen allowed region, enter realistic workload numbers, and share the estimate link with your team before building. Staff also asked teams to **share the estimate with NTT** to check.
- **Do (deck slide 16):** serverless first, meaning Lambda, S3, DynamoDB on-demand, API Gateway and **Fargate**. Start small and scale only when you hit a limit. Stop or delete idle EC2, RDS, endpoints and NAT when not building. Set your own alarms below $350.
- **Avoid (deck slide 16):** instances left running overnight, oversized GPUs without active training, **NAT gateways and multi-AZ setups for a prototype**, and orphaned EBS snapshots and load balancers.
- **Paid add-ons count too.** A team asked about subscription tokens. Staff said paid plans, such as the free / Pro / Pro+ tiers of Kiro, count against the same credit (partly GARBLED). The AWS trainer said NTT might supply a Pro plan, so ask.

---

## 4. AWS rules (deck slides 11-13)

- Sign in through the **AWS IAM Identity Center portal**. Use your registered email and the temporary password, **reset it immediately, and set up MFA (mandatory).** Choose the account **`NTT - Challenger Team NN`** and the role **`ChallengerAccess`**, in the console or the CLI. Login details come by email.
- **Only 3 regions:** `us-east-1` (N. Virginia), `ap-southeast-1` (Singapore), `ap-southeast-7` (Thailand). **Resources created in other regions are blocked automatically.**
- **Marketplace is blocked. Use native AWS services.**
- **Account isolation:** no organizational changes and no access to other teams' accounts. Staff said audit logging is on and attempts can lead to **disqualification**.
- After the 25 Oct shutdown you cannot use the account (staff). Submitting early does not close it early.

---

## 5. RoomWitness against the official evidence

| Criterion | What RoomWitness has | Gap to close |
|---|---|---|
| 1 Problem clarity | Strong sourced problem and three segments. | **No user persona and no workflow diagram.** Add one persona and the swimlane. |
| 2 Agentic behavior | 4 agents, a RAG step over Thai law (the repo builds the corpus by scraping, chunking and embedding), an LLM, a three-way verdict, and a retrieved-statute citation. This matches the "RAG, use-case LLM, agentic agent" expectation well. | **Make the agent's plan visible** in the UI or logs: the steps it took, the tool or retrieval it called, the result. The analyzing screen partly does this. |
| 3 Prototype completeness | An app and backend that run end to end. | **Sample inputs for judges, AWS deployment, and cost-efficiency evidence.** Today the AI runs on **Groq and Typhoon**, which are outside APIs, against "native AWS services". Only S3 is AWS. |
| 4 Responsible AI and safety | The renter reviews before analysis, outputs are drafts, verdicts cite law, there are confidence and low-visibility flags. | **Disclaimers** (not legal advice), an **escalation flow** (for example, low confidence points to the OCPB hotlines or a lawyer), and an **audit trail** (what inputs and which law led to each verdict, saved per case). Also a privacy note: what we keep and for how long. |
| 5 Creativity and UX | Polished mobile flow, clear story. | Tell it as a story. |
| 6 Business or social value | Sourced complaint data, a clear before-after (2-6 months of manual process to minutes of preparation), and baht at stake. | Label estimates as estimates. Pick one metric to show. |

---

## 6. Questions to send NTT

1. **Submission format:** a deck, video, repo link, deployed URL, test steps? Where do we upload?
2. **Testing after 25 Oct:** staff said accounts shut down that day. How will judges run our prototype? Is the account frozen or deleted? Should we also submit a recording?
3. **External APIs:** is calling an outside AI API from our AWS app allowed, or must the AI be an AWS service such as Bedrock?
4. **Credit balance:** the deck says a $350 cap. Our mentor mentioned $250. What is our balance now?
5. **Criteria weights:** we have the six criteria. Can the weights be shared?
6. **Kiro or other paid plans:** do they come out of the $350, or does NTT provide them?
7. **Final pitch:** length, Q and A, and the panel.
8. Which topic does our idea count under (business use case or social)?

---

## 7. Next 10 days, by owner

**Tuey:** check spend and set an alarm below $350 today. Replace the exposed key. Move the AI toward AWS (confirm with the coach first) and use the Thailand or Singapore region. Add the visible task plan and an audit trail per case. Log cost per case. Write the judge test steps with sample inputs, plus a screen recording as backup.
**KP:** draw the swimlane and write one persona. Write the disclaimer, escalation and privacy notes. Pick the one metric. Replace the pre-seed ask.
**Beam:** send the email. Find the coach and meeting times. Do not edit the deck until the submission format arrives.

---

## 8. What changed from my earlier notes

- **24 teams enter, 8 reach the final.** I had "13-20" from the garbled mentor transcript.
- **Submission is due 25 Oct 23:59**; finals are 20 Nov in person at One Bangkok; awards 24 Nov at **NTT DATA Ignite 2026**.
- **The official criteria slide is in hand.** My earlier reconstruction mixed up some items: safety belongs inside **Responsible AI and safety**, "deployed on AWS and cost efficiency" belongs under **Prototype completeness**, and creativity pairs with **user experience**. This version replaces it.
- **$350 is a strict cap**, confirmed in writing, with alerts at 50 / 80 / 90 / 100% and a freeze at 100%. Leftover credit is scored.
- **Native AWS services only; Marketplace blocked** is confirmed in writing. The cost guidance now names NAT gateways and multi-AZ explicitly.
- "Safety" as a separate criterion was my misreading.
