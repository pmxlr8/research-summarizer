# Infrastructure (AWS CDK)

All AWS resources for the project, defined as typed TypeScript.

## Stacks

| Stack | Resources |
|---|---|
| `Summarizer-{stage}-Auth` | Cognito User Pool + SPA client |
| `Summarizer-{stage}-Data` | DynamoDB single-table + S3 PDFs bucket |
| `Summarizer-{stage}-Pipeline` | SQS Jobs Queue + DLQ (Step Functions added in Week 5) |
| `Summarizer-{stage}-Api` | API Gateway + JWT authorizer + Lambda handlers |
| `Summarizer-{stage}-Frontend` | S3 + CloudFront for the static site |

`{stage}` is `dev` by default; pass `-c stage=prod` to target a different environment.

## Usage

```bash
# install once
cd infra
npm install

# generate CloudFormation (does NOT touch AWS — safe to run anytime)
npx cdk synth

# first-time account setup (once per AWS account/region)
npx cdk bootstrap

# see what would change vs what's deployed
npx cdk diff

# deploy — only when the team agrees
npx cdk deploy --all
```

## Cost Posture

Everything here uses free-tier friendly settings:

- **DynamoDB**: PAY_PER_REQUEST billing (no idle cost).
- **S3**: standard; PDF bucket has 30-day → IA transition and 90-day expiry.
- **CloudFront**: Price Class 100 (US/EU edges only).
- **Lambda**: Node 20; default 256 MB memory.
- **SQS**: standard queue.
- **Cognito**: first 10k MAUs free indefinitely.

The only service that is *not* free is Amazon Bedrock (per-token pricing), and Bedrock is not provisioned until Week 5.
