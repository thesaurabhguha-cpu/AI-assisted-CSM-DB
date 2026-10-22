# Retain OS — an AI co-pilot for Customer Success

Retain OS scores a book of B2B SaaS accounts, flags the ones a normal health score misses, and drafts a fact-checked executive business review (QBR/EBR) and save-play email for each account.

**Live demo:** _link added on deploy_ · All companies, people and numbers are synthetic.

## What it does

| Layer | Kind | What it does |
|---|---|---|
| Health score | Deterministic | Weighted 0–100 composite across usage, adoption, momentum, support, voice of customer, relationship and commercial signals. Lifecycle-aware weights; missing signals are re-weighted and listed, never imputed in the score. |
| Churn model | Learned | Logistic regression on 12 standardized signals, trained on 1,680 synthetic account histories, tested on 720 held out. |
| Disagreement flags | Deterministic | **Silent churn**: healthy score, model churn ≥ 40%. **Loud but loyal**: depressed score, model churn < 25%. |
| Draft | Language model | Gemini (Flash-Lite, discovered at runtime) writes the QBR and email as schema-constrained JSON. Every claim cites the metric IDs it uses. |
| Fact check | Deterministic | Extracts every number from every claim and matches it to a cited metric with unit-aware tolerance. Unsupported claims are shown with the reason. Internal metrics in the customer email are flagged. |
| Fallback | Deterministic | With no key, exhausted quota or malformed output, a narrative engine writes the same structure from the same metrics. |

Held-out results (synthetic data): churn model **AUC 0.875** vs health score alone **0.779**. The model's strongest risk signal is a champion change, which the rules-based score barely moves; that gap is what the silent-churn flag surfaces.

## Pages

- **Book** — chapter headline, KPI strip, risk radar (score vs churn probability, bubble = ARR), watchlist, ARR isotype, sortable account table.
- **Account** — score breakdown (points per component), model drivers (log-odds contributions), 52-week usage with events, co-pilot with pipeline trace, QBR, email and PDF export.
- **Upload CSV** — template download, PII-column rejection, in-browser scoring, co-pilot on uploaded rows.
- **How it works** — architecture, weights, model evaluation and coefficients, guardrails.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine, verifier, CSV and simulated-Gemini tests
npm run train        # retrain the churn model -> src/lib/engine/model-weights.json
```

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for live AI | Google AI Studio key. Without it the app runs the deterministic drafting engine. |
| `GEMINI_MODEL` | no | Pin a model ID. Default: newest Flash-Lite model the key can use. |
| `LIVE_RUNS_PER_IP_PER_DAY` | no | Default 5. |
| `LIVE_RUNS_GLOBAL_PER_DAY` | no | Default 200, protects the free-tier quota. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | no | Upstash Redis for shared caching and rate limits. Falls back to per-instance memory. |

## Code map

```
src/lib/data/generate.ts    seeded synthetic book + labeled history
src/lib/data/csv.ts         CSV contract, PII block, bounds, sanitizing
src/lib/engine/health.ts    weighted health score
src/lib/engine/model.ts     logistic regression, AUC, inference
src/lib/engine/assess.ts    flags + portfolio stats
src/lib/ai/metrics.ts       metric registry the AI may cite
src/lib/ai/prompt.ts        system + user prompt
src/lib/ai/gemini.ts        REST client, model discovery, schema output
src/lib/ai/verify.ts        number-level fact checker
src/lib/ai/fallback.ts      deterministic narrative engine
src/lib/ai/copilot.ts       orchestration, cache, rate limits
src/app/api/copilot         POST { accountId } or { snapshot }
```

## Limits

Synthetic data only, so the AUC describes how well the model recovers a known generating process, not real-world accuracy. Gemini's free tier may use inputs to improve Google's models; upload mock data only.

Built by Saurabh Guha.
