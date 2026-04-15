# Execution Log — Week 2 → Week 3 Handoff

This document tracks every concrete deliverable produced so far, grouped into verification phases. Each phase lists files to check and commands to run.

## Phase A — Design Artifacts

| Item | Path | How to verify |
|---|---|---|
| Week 2 report (academic formatting, no risk register or instructor questions) | `docs/Week2_Report.pdf` | Open the PDF; confirm sections 1–10 only |
| Upgrade proposal (tiered, with rationale per item) | `docs/Team_Proposal_Upgrades.pdf` | Open the PDF; 7 required + 6 nice-to-haves + 5 stretch |
| Execution guide (service-by-service explanation + 6 phases) | `docs/Project_Execution_Guide.pdf` | Open the PDF; table of contents at the front |
| Architecture diagram — landscape | `docs/Architecture.png`, `.svg` | Open; fits a letter page in landscape |
| Architecture diagram — vertical | `docs/Architecture_Vertical.png`, `.svg` | Open; portrait orientation for slides |

## Phase B — Repository Structure

```bash
cd ~/Desktop/research-summarizer
tree -L 3 -I 'node_modules|.next|cdk.out'
```

Expected:

```
research-summarizer/
├── .github/workflows/ci.yml
├── .gitignore
├── README.md
├── apps/
│   ├── web/                       # Next.js 14
│   └── api/                       # empty, Week 3
├── docs/                          # all design PDFs + diagrams
├── infra/                         # AWS CDK scaffold
├── packages/shared/               # empty, Week 3
└── scripts/                       # empty
```

## Phase C — Frontend (apps/web)

The landing page is a real marketing-style one-pager with 5 sections.

| Check | Command / Path |
|---|---|
| Builds cleanly | `cd apps/web && npm run build` |
| Runs locally | `cd apps/web && npm run dev` → http://localhost:3000 |
| Hero with gradient + aurora + stats row | `app/components/Hero.tsx` |
| Section wrapper used consistently | `app/components/Section.tsx` |
| Architecture image embedded from `public/architecture.png` | `app/page.tsx` |
| 6 service cards with hover gradient top bar | `app/components/ServiceCard.tsx` |
| 6-phase timeline | `app/components/PhaseTimeline.tsx` |
| 4 team cards with initials avatar | `app/components/TeamCard.tsx` |
| Dark mode support (OS preference) | inspected via `dark:` Tailwind classes |
| Metadata + title | `app/layout.tsx` |

## Phase D — Infrastructure (infra/, CDK)

All stacks defined but **nothing deployed**. Running `cdk synth` is safe — it only generates CloudFormation JSON locally.

| Check | Command / Path |
|---|---|
| Type-checks | `cd infra && npx tsc --noEmit` |
| Synthesizes to valid CloudFormation | `cd infra && npx cdk synth --quiet` |
| 5 stacks registered | Look for `Summarizer-dev-{Auth,Data,Pipeline,Api,Frontend}` |
| Cognito user pool with SPA client | `lib/auth-stack.ts` |
| DynamoDB single-table with GSI1 | `lib/data-stack.ts` |
| PDFs bucket with 90-day expiry lifecycle | `lib/data-stack.ts` |
| SQS Jobs Queue + DLQ (redrive after 3 fails) | `lib/pipeline-stack.ts` |
| API Gateway + Cognito authorizer + `/health` Lambda | `lib/api-stack.ts` |
| CloudFront + private S3 for the frontend | `lib/frontend-stack.ts` |

## Phase E — CI/CD

| Check | Path |
|---|---|
| GitHub Actions workflow runs on PRs and main | `.github/workflows/ci.yml` |
| Lints and builds the web app | same file |
| Infra job commented out until we add real handlers | same file |

## Phase F — Cost Posture (zero spend today)

| Service | How we keep it free |
|---|---|
| Running locally | Nothing hits AWS |
| `cdk synth` | Local-only code generation |
| `cdk deploy` | **Not yet run** — requires team alignment first |
| DynamoDB | PAY_PER_REQUEST; 25 GB of free storage |
| S3 | 5 GB free for 12 months |
| Lambda | 1M invocations / month free forever |
| API Gateway | 1M calls / month free for 12 months |
| Cognito | First 10k MAUs free forever |
| CloudFront | 1 TB egress / month free for 12 months |
| SQS | 1M requests / month free forever |
| Bedrock | Pay-per-token; not provisioned until Week 5 |

AWS Budgets alarm at $50/month is listed in the upgrade proposal (item 12).

## Phase G — What to Push to GitHub

From the repo root:

```bash
cd ~/Desktop/research-summarizer
git add .
git status             # review the file list
git commit -m "Initial project scaffold: frontend, CDK infra, docs"
git push -u origin main
```

## Not Yet Done (Future Work)

These are deliberately **not** in this scaffold — they are Week 3+ tasks:

- Actual Lambda handler code (`apps/api/handlers/*`)
- Step Functions state machine definition
- Bedrock IAM policy + SDK calls
- Frontend login/signup UI wired to Cognito
- Frontend deploy pipeline (CDK `BucketDeployment` of the Next.js export)
- First actual `cdk deploy` against your AWS account
