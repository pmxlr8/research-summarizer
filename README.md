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

![Architecture](docs/diagrams/Architecture.png)

## Repository Layout

```
research-summarizer/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   ├── app/                    # Pages and components
│   │   ├── lib/                    # Auth, API client, types
│   │   └── data/                   # Mock data (replaced by real API in Phase 2+)
│   └── api/                        # Lambda handlers (Phase 2+)
├── infra/                          # AWS CDK — all infrastructure as code
│   ├── bin/app.ts                  # Stack entry point
│   └── lib/                        # One stack per architectural layer
├── docs/
│   ├── reports/                    # PDFs: Week 2 report, proposal, execution guide
│   └── diagrams/                   # Architecture diagrams (PNG + SVG)
├── packages/shared/                # Shared TypeScript types (Phase 2+)
├── scripts/deploy.sh               # One-command deploy
└── .github/workflows/ci.yml        # Lint + build on every PR
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

| Folder | Contents |
|---|---|
| `docs/reports/` | Week 2 report, upgrade proposal, execution guide (PDFs) |
| `docs/diagrams/` | Architecture diagrams — landscape + vertical (PNG + SVG) |
| `docs/Remaining_Work.md` | Task breakdown per ownership area |

## Status

**Phase 1 complete — deployed and live at https://d24irdkbe9jj2b.cloudfront.net**

Cognito auth, API Gateway, DynamoDB, SQS, CloudFront all provisioned. Frontend shows mock data until backend Lambda handlers are implemented (Phase 2+).

## Tech Stack

- **Language**: TypeScript 5.x
- **Frontend**: Next.js 14, Tailwind CSS
- **Infrastructure**: AWS CDK v2
- **Runtime**: Node.js 20 (LTS)
- **LLM**: Claude Sonnet via Amazon Bedrock
- **CI/CD**: GitHub Actions

## Cost Posture

The design uses managed serverless services with generous free tiers. Development and a demo-scale system are expected to fit within the AWS free tier except for Bedrock token usage, which is pay-per-request and should remain modest for a class project. An AWS Budgets alarm is configured at $50/month as a safety net.
