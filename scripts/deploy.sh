#!/usr/bin/env bash
set -euo pipefail

# ─── Full deploy: infra + frontend ───────────────────────────────────
#
# What this does (in order):
#   1. Deploys all CDK stacks (Cognito, DynamoDB, SQS, API Gateway, CloudFront)
#   2. Reads the stack outputs (pool IDs, API URL, S3 bucket name)
#   3. Builds the Next.js frontend with those values baked in as env vars
#   4. Uploads the build to S3
#   5. Invalidates the CloudFront cache
#
# Prerequisites:
#   - AWS CLI configured with valid credentials (`aws configure`)
#   - Node.js 20+
#   - jq installed (`brew install jq`)
#
# Cost: all within AWS free tier except Bedrock (not touched in Phase 1).
# ─────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-dev}"
OUTPUTS="$ROOT/infra/cdk-outputs.json"

echo "==> Stage: $STAGE"

# ─── Step 1: Deploy infrastructure ───────────────────────────────────

echo ""
echo "==> [1/5] Deploying CDK stacks..."
cd "$ROOT/infra"
npm install --silent
npx cdk bootstrap --quiet 2>/dev/null || true
npx cdk deploy --all \
  -c "stage=$STAGE" \
  --require-approval never \
  --outputs-file "$OUTPUTS"

echo "    Stacks deployed. Outputs written to $OUTPUTS"

# ─── Step 2: Read stack outputs ──────────────────────────────────────

echo ""
echo "==> [2/5] Reading stack outputs..."

PREFIX="Summarizer-${STAGE}"

USER_POOL_ID=$(jq -r ".\"${PREFIX}-Auth\".UserPoolId" "$OUTPUTS")
USER_POOL_CLIENT_ID=$(jq -r ".\"${PREFIX}-Auth\".UserPoolClientId" "$OUTPUTS")
API_URL=$(jq -r ".\"${PREFIX}-Api\".ApiEndpoint" "$OUTPUTS")
BUCKET=$(jq -r ".\"${PREFIX}-Frontend\".SiteBucketName" "$OUTPUTS")
CF_DOMAIN=$(jq -r ".\"${PREFIX}-Frontend\".DistributionDomain" "$OUTPUTS")

echo "    User Pool:  $USER_POOL_ID"
echo "    Client ID:  $USER_POOL_CLIENT_ID"
echo "    API URL:    $API_URL"
echo "    S3 Bucket:  $BUCKET"
echo "    CloudFront: https://$CF_DOMAIN"

# ─── Step 3: Build frontend ──────────────────────────────────────────

echo ""
echo "==> [3/5] Building frontend with real Cognito + API config..."

cd "$ROOT/apps/web"

cat > .env.local <<EOF
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_API_URL=$API_URL
EOF

npm install --silent
npm run build

echo "    Build complete → out/"

# ─── Step 4: Upload to S3 ───────────────────────────────────────────

echo ""
echo "==> [4/5] Uploading to S3..."
aws s3 sync out/ "s3://$BUCKET" --delete --quiet
echo "    Upload complete."

# ─── Step 5: Invalidate CloudFront cache ─────────────────────────────

echo ""
echo "==> [5/5] Invalidating CloudFront cache..."

# Get the distribution ID for our bucket
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Origins.Items[].DomainName, '${BUCKET}')].Id | [0]" \
  --output text 2>/dev/null || echo "")

if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$DIST_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text
  echo "    Cache invalidated."
else
  echo "    (skipped — distribution ID not found; may take a few minutes to propagate)"
fi

# ─── Done ────────────────────────────────────────────────────────────

echo ""
echo "==> Deploy complete!"
echo ""
echo "    Live URL:  https://$CF_DOMAIN"
echo "    API:       $API_URL"
echo ""
echo "    To test: open the URL, sign up, and verify /health returns your user ID."
