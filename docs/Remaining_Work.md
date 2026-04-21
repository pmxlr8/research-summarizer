# Remaining Work — Week 3 Onwards

Live site: https://d24irdkbe9jj2b.cloudfront.net
Repo: https://github.com/pmxlr8/research-summarizer

## What's deployed and working

- S3 + CloudFront serving the Next.js frontend (HTTPS, edge-cached)
- Cognito user pool (email signup, verification, JWT login)
- API Gateway with Cognito JWT authorizer (`/health` returns 401 without auth, 200 with)
- DynamoDB table (single-table design, empty)
- SQS Jobs Queue + Dead Letter Queue
- S3 PDFs bucket (90-day lifecycle)

The frontend runs in dual mode: mock data locally, real Cognito + API when deployed.

## What each person needs to build

### Frontend owner

| Task | Priority | Description |
|---|---|---|
| Wire dashboard to call `/health` | High | Call `healthCheck()` from `lib/api.ts` on the dashboard and display real user info |
| Confirmation code page | High | After signup, Cognito sends a verification code by email. Build a `/confirm` page that calls `confirmSignUp(email, code)` from `lib/auth.ts` |
| Real search results UI | Medium | Once `searchFn` Lambda is live, the frontend already calls it via `lib/api.ts` — just verify it works |
| Real summary status polling | Medium | Once the pipeline is live, add polling on `/app` dashboard: re-fetch summaries every 5s while any are `running` |
| Loading and error states | Low | Add toast notifications for API errors; better empty states |

### API + Auth owner

| Task | Priority | Description |
|---|---|---|
| `searchFn` Lambda | High | Implement the arXiv API integration. Accept `?q=query`, call `http://export.arxiv.org/api/query`, parse the Atom XML, return JSON array of papers. Add the Lambda + route in `infra/lib/api-stack.ts` |
| `submitJobFn` Lambda | High | Accept `{paperId}`, write a `JOB#{jobId}` record to DynamoDB with status `pending`, send a message to SQS, return `{jobId}` with HTTP 202 |
| `getSummaryFn` Lambda | High | Accept `/{jobId}`, read from DynamoDB, return the job record (status + summary if done) |
| CORS on new endpoints | Medium | The CDK api-stack already has CORS configured globally — just verify new endpoints inherit it |

### Pipeline owner

| Task | Priority | Description |
|---|---|---|
| Step Functions state machine | High | Define the state machine in `infra/lib/pipeline-stack.ts`. Five states: FetchPDF → ExtractText → Chunk → MapSummarize → ReduceSummary |
| `FetchPDF` Lambda | High | Download the paper PDF from arXiv, write to the S3 PDFs bucket |
| `ExtractText` Lambda | High | Read PDF from S3, extract text (use `pdf-parse` npm package) |
| `Chunk` Lambda | Medium | Split text into overlapping chunks (~2000 tokens each, 200 token overlap) |
| `MapSummarize` Lambda | High | Call Bedrock (Claude Sonnet) with a structured prompt per chunk. Use the `@aws-sdk/client-bedrock-runtime` package. Request model access for `anthropic.claude-3-5-sonnet-20241022-v2:0` in the Bedrock console first |
| `ReduceSummary` Lambda | Medium | Combine chunk summaries into final structured output (Objectives, Methods, Results, Limitations, Contributions). Write to DynamoDB. Update job status to `done` |

### Data + Ops owner

| Task | Priority | Description |
|---|---|---|
| CloudWatch dashboard | High | Create a dashboard with widgets for: Lambda errors, API Gateway 5xx rate, DLQ depth, Step Functions execution failures |
| CloudWatch alarms | High | Alarms on: DLQ depth > 0, Lambda error rate > 1%, Step Functions failure |
| SNS topic for alerts | Medium | Wire alarms to an SNS topic that emails the team |
| Budget alarm | High | Set up AWS Budgets alarm at $50/month (takes 5 min in the console) |
| DynamoDB monitoring | Low | Verify read/write capacity is healthy under load; check GSI throughput |

## How to add a new Lambda endpoint

Example: adding `POST /search`.

1. Write the handler in `apps/api/handlers/search.ts`
2. In `infra/lib/api-stack.ts`, create a new `lambda.Function`, add a route:
   ```typescript
   const searchFn = new lambda.Function(this, "SearchFn", {
     runtime: lambda.Runtime.NODEJS_20_X,
     handler: "search.handler",
     code: lambda.Code.fromAsset("../apps/api/handlers"),
     environment: { TABLE_NAME: props.table.tableName },
   });
   props.table.grantReadData(searchFn);
   api.root.addResource("search").addMethod("GET", new apigw.LambdaIntegration(searchFn), authProps);
   ```
3. `cd infra && npx cdk deploy Summarizer-dev-Api`
4. Test: `curl -H "Authorization: <jwt>" https://2nnh105h8a.execute-api.us-east-1.amazonaws.com/v1/search?q=transformer`

## How to redeploy the frontend

```bash
cd ~/Desktop/research-summarizer
./scripts/deploy.sh
```

Or manually:
```bash
cd apps/web && npm run build
aws s3 sync out/ s3://summarizer-dev-frontend-sitebucket397a1860-nhya3rmcnk7a --delete
aws cloudfront create-invalidation --distribution-id E3L0201HN5GVEA --paths "/*"
```

## Cost check

Current monthly cost estimate with all stacks deployed and no traffic: **$0.00**.
First real cost comes when someone calls Bedrock in Phase 3 (~$0.003 per page of a paper).
