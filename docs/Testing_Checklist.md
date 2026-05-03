# Testing Checklist

Live URLs:
- App: https://d24irdkbe9jj2b.cloudfront.net
- API: https://2nnh105h8a.execute-api.us-east-1.amazonaws.com/v1/

Use a fresh browser profile or incognito window so you start signed-out.

## A. Auth flow

| # | Action | Expected | Notes |
|---|---|---|---|
| A1 | Open the landing page | Loads the marketing page with hero + sections | |
| A2 | Click "Get started" | Routes to `/signup/` | |
| A3 | Submit empty form | Inline validation fires | |
| A4 | Submit invalid email | Inline validation fires | |
| A5 | Submit weak password (< 8 chars) | "Password must be at least 8 characters" | |
| A6 | Sign up with a real email and Cognito-compliant password (10+ chars, upper+lower+digit) | Routes to `/confirm?email=...` | Cognito password policy |
| A7 | Check the email inbox | A 6-digit verification code arrives within ~30s | check spam |
| A8 | Submit wrong code | Red error: "Invalid verification code provided, please try again." | |
| A9 | Submit correct code | Green checkmark, auto-redirect to `/login` | |
| A10 | Log in with the new credentials | Routes to `/app` | |
| A11 | Open `/app` in a new tab while logged in | Loads dashboard immediately, no redirect | localStorage session |
| A12 | Open `/app` in incognito (no session) | Redirects to `/login` | auth gate working |
| A13 | Click "Sign out" | Routes to `/`, session cleared | |
| A14 | Try to visit `/app` after signout | Redirects to `/login` | |

## B. Dashboard

| # | Action | Expected | Notes |
|---|---|---|---|
| B1 | Land on `/app` after login | Sidebar visible, three stat cards, search input, "Recent summaries" header | |
| B2 | Stat cards | "Summaries Generated", "In Progress", "Quota Remaining" (∞) | |
| B3 | First-time user | Empty state under "Recent summaries" with "Start searching" CTA | |
| B4 | Click the email block in the sidebar | Shows your email below your initial avatar | |
| B5 | Click sidebar Search nav | Routes to `/app/search` | |
| B6 | Click sidebar Dashboard nav | Routes back to `/app` | |
| B7 | Type in dashboard search box and submit | Routes to `/app/search?q=...` with the typed query | |
| B8 | Resize the window narrow | Mobile top bar appears, sidebar hides | |

## C. Search

| # | Action | Expected | Notes |
|---|---|---|---|
| C1 | Visit `/app/search` with no query | "Enter a search term" prompt | |
| C2 | Search for `transformer` | Real arXiv results appear in 1-2s | not the mock 8 papers anymore |
| C3 | Each result shows | Title, authors (truncated past 4), year, arXiv ID, abstract (3-line clamp) | |
| C4 | Click "PDF" on any result | Opens arXiv PDF in a new tab | |
| C5 | Click "Summarize" on a result | Submits a real job; alert shows the jobId | check Network tab — POST /summarize returns 202 |
| C6 | Search for nonsense like `qwertyzzz` | "No results for ..." empty state | |
| C7 | Search with a 200+ char query | Backend rejects with `invalid_query` | |
| C8 | Send 5 rapid searches in a row | First few may be slow due to arXiv rate limits, retries handle it | |
| C9 | Inspect Network → /search response | Returns Paper[] JSON with arxiv IDs | |

## D. Summary lifecycle

| # | Action | Expected | Notes |
|---|---|---|---|
| D1 | After submitting a summary, return to `/app` | A new card appears with status "Pending" or "Running" | |
| D2 | Wait ~30-60 seconds, refresh `/app` | Card status flips to "Done" with duration shown | |
| D3 | Click a "Done" card | Routes to `/app/summary/<jobId>` | |
| D4 | Summary detail page shows | Paper title, authors, year, abstract, 5 sections, keywords | |
| D5 | Each section | Heading + 3-5 bullets | |
| D6 | "View original PDF" link | Opens arXiv PDF in new tab | |
| D7 | "Back to dashboard" link | Routes to `/app` | |
| D8 | Refresh the summary page | Loads from cache via getSummary, no flicker beyond skeleton | |
| D9 | Visit `/app/summary/nonexistent` | "Summary not found" with back-to-dashboard button | |

## E. Failure cases

| # | Action | Expected | Notes |
|---|---|---|---|
| E1 | Submit a summary for a paper with no `pdfUrl` | Job marked failed, status badge shows "Failed" | |
| E2 | Submit a summary for a malformed/scanned PDF | Job marked failed with error message | extract-text guards on suspiciously short text |
| E3 | Look at CloudWatch Logs for any failure | Each step logs structured JSON; failure handler updates DDB | |

## F. API endpoints (direct curl)

You can grab the JWT from the browser: Cognito stores it in localStorage as `CognitoIdentityServiceProvider...idToken`. Or sign in via aws-cli equivalent.

| # | Endpoint | Without token | With valid token |
|---|---|---|---|
| F1 | `GET /v1/health` | 401 Unauthorized | 200 + userId + email |
| F2 | `GET /v1/search?q=transformer` | 401 | 200 + Paper[] |
| F3 | `POST /v1/summarize` | 401 | 202 + {jobId} |
| F4 | `GET /v1/summaries` | 401 | 200 + Summary[] |
| F5 | `GET /v1/summaries/{id}` | 401 | 200 + Summary or 404 |

## G. Cross-cutting

| # | Action | Expected |
|---|---|---|
| G1 | Toggle OS dark mode | UI follows; backgrounds, text, borders all switch |
| G2 | Light/dark contrast on every page | Text remains legible, gradient accents preserved |
| G3 | Tab through the page with keyboard | Focus rings appear on all interactive elements |
| G4 | Hard refresh (Cmd+Shift+R) on any page | Loads cleanly without flicker |
| G5 | Network tab → check `/architecture.png` | Cached at edge after first load |
| G6 | Check CloudFront response headers | `x-cache: Hit from cloudfront` on second request |

## H. Observability

| # | Where | What to look for |
|---|---|---|
| H1 | CloudWatch → Log groups → `/aws/lambda/Summarizer-dev-Api-*` | Structured JSON logs per request |
| H2 | Step Functions console → state machine | Visual graph; click any execution to see state-by-state durations |
| H3 | DynamoDB → Items in MainTable | One PROFILE# item per user, JOB# items for each summary |
| H4 | SQS → Jobs Queue | Should be empty when idle; messages appear briefly during /summarize |
| H5 | SQS DLQ | Should be empty; non-empty means a job failed 3+ times |

## Known gotchas

- Bedrock model is currently **Qwen 3 Next 80B** (not Claude). To switch to Claude Sonnet, fill out the Anthropic use-case-details form in Bedrock Console → Model access, wait 15 minutes, then update `BEDROCK_MODEL_ID` in `infra/lib/pipeline-stack.ts` to `us.anthropic.claude-sonnet-4-5-20250929-v1:0` and redeploy the pipeline stack.
- arXiv rate-limits AWS Lambda IPs aggressively. Search has retry-with-backoff but may take up to 5 seconds on a cold start.
- The first Lambda invocation after deploy takes longer (cold start). Subsequent calls are fast.
- CloudFront cache invalidation on a new frontend deploy takes ~30-60 seconds.
