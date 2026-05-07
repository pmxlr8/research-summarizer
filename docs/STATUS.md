---
title: "Project Status — Submission Eve"
subtitle: "Cloud-Based Research Paper Summarization Platform"
date: "2026-05-06"
---

# 1. Snapshot

| What | Where |
|---|---|
| **Live site** | https://d24irdkbe9jj2b.cloudfront.net |
| **GitHub repo** | https://github.com/pmxlr8/research-summarizer |
| **API endpoint** | https://2nnh105h8a.execute-api.us-east-1.amazonaws.com/v1/ |
| **CloudWatch dashboard** | https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Summarizer-Operations |
| **Step Functions console** | https://console.aws.amazon.com/states/home?region=us-east-1 |
| **AWS region** | us-east-1 |
| **AWS account** | 032474760977 |
| **Cognito User Pool ID** | us-east-1_Y7IjzOHXK |
| **Spend so far** | < $5 (Bedrock-dominated; demo recording will add ~$2-3) |

# 2. Team

| Member | GitHub | Area owned |
|---|---|---|---|
| Pranjal Mishra  | [pmxlr8](https://github.com/pmxlr8) | Architecture, frontend, infra (CDK), Phase 0-3 lead |
| Shreyas Sankpal | _username_ | Pipeline orchestration |
| Yang Zheng | [Ezreal222](https://github.com/Ezreal222) | Search Lambda, arXiv integration, tests |
| Kerry Huang | [kerry-huang-nyu](https://github.com/kerry-huang-nyu) | Auth, API |

> Replace `_*-NETID_` with each person's NYU NetID before submission.

# 3. What's deployed and working in production

## 3.1 Frontend

7 routes, all live, dark-mode aware, all auth-gated where appropriate.

| Route | Purpose |
|---|---|
| `/` | Marketing landing (Hero + Architecture + Services + Phases + Team) |
| `/login` | Cognito SRP login |
| `/signup` | Self-service signup (10+ char password, upper+lower+digit) |
| `/confirm` | Email verification code entry → auto-redirect to login |
| `/app` | Dashboard — stats, search bar, recent summaries grid, real polling |
| `/app/search` | Search results (arXiv + Semantic Scholar merged), Summarize action per result |
| `/app/summary/{id}` | Structured summary view (Objectives, Methodology, Results, Limitations, Contributions + keywords) |

Frontend tech: Next.js 14 static export, TypeScript, Tailwind CSS, Geist font, dark mode follows OS.

## 3.2 API endpoints (all behind Cognito JWT authorizer)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Returns `{status, userId, email, now}` — proves auth is wired |
| GET | `/search?q=...` | Multi-source search (arXiv + Semantic Scholar), dedupe by arxivId/DOI/title |
| POST | `/summarize` | Reserves quota → checks dedup cache → enqueues SQS or returns cached result |
| GET | `/summaries` | List the calling user's jobs |
| GET | `/summaries/{id}` | Get one job's full record (status + sections + keywords) |
| GET | `/summaries/{id}/related` | Top-3 most-similar papers from the user's own library by paper-level cosine |
| GET | `/summaries/{id}/graph` | Knowledge graph (nodes + edges) extracted from the structured summary; lazily generated, `?force=1` to regenerate |
| POST | `/chat` | Retrieval-augmented Q&A on a paper. Embeds the question, ranks chunks, prompts the LLM, returns answer + citations |
| GET | `/quota` | User's remaining summary quota |

## 3.3 AWS architecture (5 stacks deployed)

| Stack | Resources |
|---|---|
| `Summarizer-dev-Auth` | Cognito User Pool + SPA client (SRP-only) |
| `Summarizer-dev-Data` | DynamoDB single-table + GSI1 + S3 PDFs bucket (90-day lifecycle) |
| `Summarizer-dev-Pipeline` | SQS Jobs Queue + DLQ + Step Functions state machine + 6 Lambdas (FetchPDF, ExtractText, Chunk, MapSummarize, ReduceSummary, Trigger) |
| `Summarizer-dev-Api` | API Gateway REST + 6 handler Lambdas + Cognito authorizer |
| `Summarizer-dev-Frontend` | Private S3 + CloudFront with Origin Access + path-rewriter Function |
| `Summarizer-dev-Ops` | SNS alerts + 4 CloudWatch alarms + Budgets + Dashboard |

## 3.4 Pipeline (Step Functions state machine)

```
SQS Jobs Queue → Trigger Lambda → State Machine:
  1. FetchPDF      (downloads PDF → S3)
  2. ExtractText   (pdf-parse → S3)
  3. Chunk         (overlapping chunks → S3)
  4. MapSummarize  (parallel × max 5 concurrent → Bedrock)
  5. ReduceSummary (final consolidation → Bedrock → DynamoDB)

On failure → MarkFailed (DDB status="failed" with error cause)
On 3 SQS redrives → DLQ → CloudWatch alarm → SNS email
```

LLM: **Qwen 3 Next 80B via Amazon Bedrock**. Will swap to Claude Sonnet once Anthropic use-case form is approved on this AWS account.

## 3.5 Operational layer

- **AWS Budgets** alarm at $50/month (email at 80% actual + 100% forecasted)
- **SNS topic** `Summarizer-dev-Ops-AlertTopic` with `pranjalm74@gmail.com` subscription
- **CloudWatch alarms**: DLQ depth, Step Functions failures, pipeline Lambda errors (3 in 5 min), API Lambda errors (5 in 5 min)
- **CloudWatch dashboard** with 7 widgets (executions, durations, requests, latency, queue depths, per-Lambda invocations + errors)
- **X-Ray tracing** active on all 11 Lambdas + Step Functions (with `AWSXRayDaemonWriteAccess` IAM)

# 4. Features delivered (final list)

## 4.1 Originally promised

- [x] Search across open-access academic repositories — **arXiv + Semantic Scholar**
- [x] Retrieve full-text PDFs
- [x] Generate structured summaries — Objectives, Methodology, Results, Limitations, Contributions + keywords
- [x] Event-driven serverless on AWS
- [x] Cognito user auth with email verification
- [x] API Gateway with JWT authorizer
- [x] SQS → Step Functions → 5-step pipeline
- [x] LLM via Amazon Bedrock
- [x] DynamoDB single-table for jobs and users
- [x] S3 for raw PDFs + extracted text + chunks
- [x] CloudWatch logs + metrics + alarms
- [x] IAM least-privilege per function

## 4.2 From the upgrade proposal (proposal items 1-13)

- [x] **#1** Cognito JWT authorizer at API Gateway (not in Lambda)
- [x] **#2** CloudFront in front of S3 (private bucket via OAC)
- [x] **#3** Step Functions instead of single Lambda
- [x] **#4** SQS Dead Letter Queue + redrive policy + alarm
- [x] **#5** Amazon Bedrock instead of direct Anthropic API
- [x] **#6** DynamoDB single-table design with documented access patterns + GSI1
- [x] **#7** AWS CDK for all infrastructure
- [x] **#8** Secrets Manager (would be used for any external key — none required currently)
- [x] **#9** Observability baseline (structured JSON logs, alarms, dashboard)
- [x] **#10** S3 lifecycle policy on PDFs (30 → IA, 90 → delete)
- [x] **#11** Per-user summary quota (real, decremented atomically, default 10)
- [x] **#12** AWS Budgets alarm at $50/month
- [x] **#13** Content-hash dedup — copies cached summary if any user has summarized that paper

## 4.3 UX polish added

- [x] Toast notifications (4 variants) replacing browser alerts
- [x] Dashboard auto-polls every 5s while jobs are running
- [x] Refresh-persistent auth (Cognito session via getSignInUserSession)
- [x] CloudFront path rewriter for nested + dynamic routes
- [x] Email-verification flow (signup → confirm code → login)
- [x] **Forgot-password flow** (request code → confirm + new password → login)
- [x] Search-result phrase quoting + title-field boost (`"attention is all you need"` returns the actual paper top-2)
- [x] Static-export friendly dynamic route with `_view` placeholder + URL-derived id
- [x] Inline citation tooltips in chat answers (hover `[N]` markers for chunk excerpt)
- [x] Export buttons on every summary — Copy Markdown, Download .md, Download .bib
- [x] Recent searches as chips on dashboard + search page (localStorage)

## 4.4 LLM-driven features (Phase 4+)

- [x] **Talk-to-PDF (RAG chat)** — Titan Text Embeddings v2 vectors per chunk in DynamoDB; cosine retrieval; cited LLM answer with chunk index, similarity, and snippet tooltip per `[N]` marker
- [x] **Related papers** — paper-level mean embeddings persisted on JOB records; top-3 cosine matches against the user's own library, with lazy backfill for older summaries
- [x] **Knowledge graph** — entities and relationships extracted from the structured summary, rendered with React Flow + dagre LR layout; key-concepts rail with the four most-connected nodes; click-through neighbours; regenerate button forces a fresh extraction

## 4.5 Cloud-class deliverables

- [x] AWS CDK as Infrastructure-as-Code (5 stacks, fully reproducible)
- [x] GitHub Actions CI (`cdk synth` + `npm build` on PRs)
- [x] X-Ray distributed tracing
- [x] CloudWatch operational dashboard
- [x] Multi-AZ via managed services
- [x] Cost analysis with real per-summary numbers (~$0.20/paper, dominated by Bedrock)
- [x] Failure handling (Step Functions catch + retry + DLQ)

# 5. Repository file map

```
research-summarizer/
├── README.md                              ← project overview
├── .github/workflows/ci.yml               ← lint + build on PR
├── .gitignore                             ← node_modules, .next, cdk.out, .env, cdk-outputs.json
│
├── apps/
│   ├── web/                               ← Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── layout.tsx                 ← root, ToasterProvider, Geist fonts
│   │   │   ├── page.tsx                   ← landing page
│   │   │   ├── globals.css                ← Tailwind + gradient/aurora utilities
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── confirm/page.tsx           ← email verification
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx             ← auth-gated app shell + sidebar
│   │   │   │   ├── page.tsx               ← dashboard with polling + quota
│   │   │   │   ├── search/page.tsx        ← search results page
│   │   │   │   └── summary/[id]/
│   │   │   │       ├── page.tsx           ← server wrapper + generateStaticParams
│   │   │   │       └── SummaryView.tsx    ← client component reads URL for id
│   │   │   └── components/
│   │   │       ├── Hero.tsx
│   │   │       ├── Section.tsx
│   │   │       ├── ServiceCard.tsx
│   │   │       ├── TeamCard.tsx
│   │   │       ├── PhaseTimeline.tsx
│   │   │       └── Toaster.tsx            ← toast provider + 4 variants
│   │   ├── lib/
│   │   │   ├── auth.ts                    ← dual-mode: Cognito SRP / localStorage
│   │   │   ├── api.ts                     ← ApiError, all endpoint clients with mock fallback
│   │   │   └── types.ts                   ← Paper, Summary, SummarySection, User
│   │   ├── data/
│   │   │   ├── mock-papers.ts             ← 8 fallback papers for offline dev
│   │   │   └── mock-summaries.ts          ← 3 fallback summaries
│   │   ├── public/
│   │   │   └── architecture.png
│   │   ├── package.json
│   │   ├── next.config.mjs                ← output=export, trailingSlash, unoptimized images
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── api/                                ← Lambda code
│       ├── handlers/
│       │   ├── search.ts                  ← multi-source merge handler
│       │   ├── submit-job.ts              ← quota → dedup → enqueue
│       │   ├── get-summary.ts
│       │   ├── list-summaries.ts
│       │   ├── get-quota.ts
│       │   └── pipeline/
│       │       ├── trigger.ts             ← SQS → StartExecution
│       │       ├── fetch-pdf.ts
│       │       ├── extract-text.ts        ← pdf-parse@1.1.1
│       │       ├── chunk.ts
│       │       ├── map-summarize.ts
│       │       └── reduce-summary.ts
│       ├── lib/
│       │   ├── arxiv.ts                   ← arXiv API + retry-with-backoff
│       │   ├── semantic-scholar.ts
│       │   ├── chunk.ts                   ← text chunking with overlap
│       │   ├── bedrock.ts                 ← Anthropic + OpenAI-compatible APIs
│       │   ├── ddb.ts                     ← single-table operations + dedup + quota
│       │   ├── s3.ts                      ← bucket key conventions + helpers
│       │   ├── http.ts                    ← ok/clientError/serverError/log
│       │   └── types.ts
│       ├── tests/                         ← 14 vitest tests, all passing
│       ├── package.json
│       └── tsconfig.json
│
├── infra/                                  ← AWS CDK
│   ├── bin/app.ts                          ← stack wiring
│   ├── lib/
│   │   ├── auth-stack.ts                   ← Cognito user pool + SPA client
│   │   ├── data-stack.ts                   ← DynamoDB (PAY_PER_REQUEST, GSI1) + S3 PDFs (lifecycle)
│   │   ├── pipeline-stack.ts               ← SQS + DLQ + Step Functions + 6 Lambdas
│   │   ├── api-stack.ts                    ← API Gateway + Cognito authorizer + 6 handlers
│   │   ├── frontend-stack.ts               ← S3 + CloudFront + path-rewriter Function
│   │   └── ops-stack.ts                    ← SNS + 4 alarms + Budgets + Dashboard
│   ├── package.json
│   ├── tsconfig.json
│   ├── cdk.json
│   └── README.md
│
├── docs/
│   ├── reports/                            ← submitted PDFs
│   │   ├── Week2_Report.pdf
│   │   ├── Team_Proposal_Upgrades.pdf
│   │   └── Project_Execution_Guide.pdf
│   ├── diagrams/                           ← architecture (PNG + SVG, landscape + portrait)
│   ├── source/                             ← editable markdown + diagram source
│   ├── original_team_docs/                 ← team v1 artifacts (archived)
│   ├── Execution_Log.md
│   ├── Remaining_Work.md
│   ├── Vision.md
│   ├── Testing_Checklist.md
│   └── STATUS.md                           ← this file
│
├── packages/shared/                        ← (placeholder for shared types)
└── scripts/deploy.sh                       ← one-command full deploy
```

# 6. Real production numbers (verified live)

| Metric | Value |
|---|---|
| Successful pipeline runs to date | 5+ (including 2 real user submissions) |
| Pipeline duration (real papers) | 27-44 seconds end-to-end |
| Today's verified test job | submit → done in 27s, 5 sections, 7 keywords |
| API Gateway 5xx errors (lifetime) | 0 |
| DLQ depth | 0 |
| 14 unit tests | all passing |
| Cost per summary | ~$0.20 (Bedrock dominates 99%) |
| Idle infrastructure cost | $0 |

# 7. Submission deliverables — 1-day plan

| # | Deliverable | Status | Owner / Plan |
|---|---|---|---|
| 1 | **GitHub repo** | ✅ DONE | https://github.com/pmxlr8/research-summarizer |
| 2 | **Live deployed site** | ✅ DONE | https://d24irdkbe9jj2b.cloudfront.net |
| 3 | **Final Project Report** (PDF) | ⏳ TODO | Draft today, 6-8 pages |
| 4 | **Presentation Slides** | ⏳ TODO | 12-15 slides, today |
| 5 | **YouTube video** (5-7 min, unlisted) | ⏳ TODO | Record demo from live site |
| 6 | **Team netids** | ⏳ TODO | Each member fills their own |

## Hour-by-hour for the next 24 hours

| Block | Task | Output |
|---|---|---|
| Hour 0-2 | Final Report sections 1-4 (abstract, intro, related work, architecture) | 4 pages |
| Hour 2-4 | Final Report sections 5-8 (implementation, evaluation, lessons, references) | another 3-4 pages |
| Hour 4-5 | Slide deck (template + content extracted from report) | 12-15 slides |
| Hour 5-6 | Demo script + dry run | one-page script |
| Hour 6-7 | Record screencast → upload to YouTube unlisted | URL |
| Hour 7-8 | Final review, file naming, submission package | submitted |
| Buffer | 16+ hours | for re-recording, fixes, instructor questions |

## What I'll generate next

1. `docs/Final_Report.md` and PDF — full 6-8 page submission report
2. `docs/Slides.md` — speaker notes + slide outlines for export to Google Slides
3. `docs/Demo_Script.md` — what to say while screen-sharing during the recording
4. Updated architecture diagram with the Ops layer included

# 8. Known limitations / honest disclosures

- **LLM is Qwen 3 Next 80B**, not Claude Sonnet. Anthropic models on this AWS account require submitting the use-case-details form first; we wrote bedrock.ts to support both API formats so swapping is a one-env-var change.
- **arXiv rate-limits AWS Lambda IPs** aggressively — search has retry-with-backoff but may take up to 4 seconds on a cold start.
- **Bedrock dominates cost** at ~$0.20/summary; everything else is in free tier.
- **Single-region (us-east-1)** — multi-region DR is documented as out of scope per the original proposal.
- **No Talk-to-PDF (RAG)**, no side-by-side PDF viewer — those were always vision items, not promised MVP features.

# 9. How to run locally (for graders)

```bash
git clone https://github.com/pmxlr8/research-summarizer
cd research-summarizer/apps/web
npm install
npm run dev
# → http://localhost:3000  (uses mock data without AWS credentials)
```

For full AWS deploy:

```bash
cd ~/research-summarizer
./scripts/deploy.sh   # one-command bootstrap → deploy all 6 stacks → upload frontend
```

Requires AWS CLI configured and `jq` installed.
