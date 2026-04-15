# Research Paper Summarizer

A serverless AWS platform that searches open-access academic repositories (arXiv, Semantic Scholar, Crossref), fetches full-text PDFs, and produces structured summaries — objectives, methodology, results, limitations, contributions — using Claude Sonnet via Amazon Bedrock.

> NYU Cloud Computing, Spring 2026

## Team

| Member | Ownership Area |
|---|---|
| Shreyas Sankpal | Pipeline & Orchestration (Step Functions, pipeline Lambdas, Bedrock) |
| Pranjal Mishra | Architecture & Frontend (Next.js, AWS CDK, design docs) |
| Yang Zheng | Data Layer (DynamoDB schema, S3 buckets, storage policies) |
| Kerry Huang | Auth & API (Cognito, API Gateway, handler Lambdas) |

## Architecture

See `docs/Architecture.png` for the full topology diagram. In one sentence: a static Next.js frontend served from S3 via CloudFront, a Cognito-authenticated REST API Gateway routing to Lambda handlers, an asynchronous summarization pipeline orchestrated by Step Functions, and a DynamoDB single-table store for users, jobs, and summaries.

![Architecture](docs/Architecture.png)

## Repository Layout

```
research-summarizer/
├── apps/
│   ├── web/                   # Next.js 14 frontend (TypeScript + Tailwind)
│   └── api/                   # Lambda handler code (Week 3+)
│       └── handlers/
│           ├── search.ts
│           ├── submit-job.ts
│           ├── get-summary.ts
│           └── pipeline/
│               ├── fetch-pdf.ts
│               ├── extract-text.ts
│               ├── chunk.ts
│               ├── map-summarize.ts
│               └── reduce-summary.ts
├── packages/
│   └── shared/                # TypeScript types shared between web and api
├── infra/                     # AWS CDK (infrastructure as code)
│   ├── bin/app.ts
│   └── lib/
│       ├── frontend-stack.ts
│       ├── auth-stack.ts
│       ├── api-stack.ts
│       ├── data-stack.ts
│       └── pipeline-stack.ts
├── docs/                      # Architecture diagrams, reports, proposals
├── scripts/                   # Helper scripts
└── .github/workflows/         # CI/CD
```

## Local Development

### Frontend

```bash
cd apps/web
npm install
npm run dev
# open http://localhost:3000
```

### Infrastructure (Week 3+)

```bash
cd infra
npm install
npx cdk synth        # generates CloudFormation without deploying
npx cdk diff         # shows changes vs deployed stack
# npx cdk deploy     # don't run this without team alignment
```

## Documentation

All design artifacts live in `docs/`:

| File | What it is |
|---|---|
| `Week2_Report.pdf` | Week 2 progress report (architecture, WAF mapping, SLOs) |
| `Team_Proposal_Upgrades.pdf` | Proposed upgrades to the Week 2 design — tiered by priority |
| `Project_Execution_Guide.pdf` | Service-by-service explanation, six-phase plan, repo conventions |
| `Architecture.png` / `.svg` | Architecture diagram (landscape, for documents) |
| `Architecture_Vertical.png` / `.svg` | Architecture diagram (portrait, for slides) |

## Status

**Week 2 — design phase complete.** Week 3 kicks off Phase 0 (foundation): AWS account setup, CDK scaffold, CI workflow, and the first end-to-end deployment of a "walking skeleton".

Phase checkpoints are tracked in `docs/Project_Execution_Guide.pdf` (§4).

## Tech Stack

- **Language**: TypeScript 5.x
- **Frontend**: Next.js 14, Tailwind CSS
- **Infrastructure**: AWS CDK v2
- **Runtime**: Node.js 20 (LTS)
- **LLM**: Claude Sonnet via Amazon Bedrock
- **CI/CD**: GitHub Actions

## Cost Posture

The design uses managed serverless services with generous free tiers. Development and a demo-scale system are expected to fit within the AWS free tier except for Bedrock token usage, which is pay-per-request and should remain modest for a class project. An AWS Budgets alarm is configured at $50/month as a safety net.
