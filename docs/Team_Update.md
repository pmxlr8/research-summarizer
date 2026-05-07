## submission day is tomorrow, here's where we stand

### Live links
- **Site:** https://d24irdkbe9jj2b.cloudfront.net
- **Repo:** https://github.com/pmxlr8/research-summarizer
- **CloudWatch dashboard:** [Summarizer-Operations](https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Summarizer-Operations)

### What's working end-to-end (verified in production)

- Sign up → email verification → login → dashboard, all on Cognito
- Multi-source search across **arXiv + Semantic Scholar** (Yang's search Lambda is in there + I added Semantic Scholar on top)
- Submit a paper → SQS → Step Functions → 5-step pipeline (FetchPDF → ExtractText → Chunk → MapSummarize → ReduceSummary) → Bedrock → DynamoDB
- Real summary returned in **27-44 seconds** with 5 sections + keywords
- Per-user quota (10 / period), content-hash dedup so we don't re-summarize the same paper twice, retry + DLQ + alarms wired to SNS
- Full CloudWatch dashboard, X-Ray tracing, CDK as code, $50 budget alarm
- Heads up: we're using **Qwen 3 Next 80B** instead of Claude Sonnet because Anthropic's model-access form on our AWS account is still pending. Bedrock client supports both API formats so flipping back is one env var when it clears.

### The honest gap — the app *works* but feels basic

Right now you submit a paper and get a structured bullet-list summary back. That's the MVP from the proposal. To not look like a hackathon project in the demo, I think we should add **at least one** of these as a heavy-hitter feature for the recording:

| | Feature | What it adds | Effort |
|---|---|---|---|
| **A** | **Talk to PDF (RAG)** | Chat panel on the summary page. Ask any question about the paper, get an answer cited to the chunks. Embeds the chunks we already store, retrieves top-k, prompts the LLM. Single biggest "wow" feature. | ~1 day |
| **B** | **Side-by-side PDF viewer** | The summary on the left, original PDF on the right, scrolled in sync. Makes the summaries feel grounded. | ~half day |
| **C** | **Compare papers** | Pick 2-3 summaries → unified table comparing methodology / results / limitations across them. Differentiator vs other class projects. | ~half day |
| **D** | **Streaming chat answers** | Token-by-token typing for whatever chat we add. Pure UX win. | ~3 hr |

I'd vote **A (Talk to PDF)**. It rides on the chunked text we already write to S3 — adds an embed step + a /chat endpoint + a chat UI. Genuinely useful, not just demo theater.

### What's still left for tomorrow's submission

Per the brief, we owe:
1. Final Project Report (PDF, 6-8 pages)
2. Presentation slides (12-15 slides)
3. YouTube video (5-7 min, unlisted)
4. GitHub repo — done
5. Team netids in the submission

### Who wants to do what?

I can grind out everything solo if I have to but it'll go faster if we split. Pick something:

- **Final report** — I can draft it, but a second pair of eyes reviewing and tightening the writing would help a lot
- **Slide deck** — same, draft + review
- **Demo video** — I'll record from the live site, but if anyone wants to be the on-camera narrator, that'd actually be better