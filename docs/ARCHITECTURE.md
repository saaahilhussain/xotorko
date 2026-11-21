# Architecture

Xotorko is a single Express app. Gemini reads the manipulation in a message. Deterministic code owns everything a user acts on: link checks, the verdict, advice and phone numbers.

```mermaid
flowchart TD
    U[User pastes message] --> API[POST /api/analyze<br/>10 kb body limit, 30 req/min/IP]
    API --> S[lib/sanitize.js<br/>trim, max 2000 chars, reject empty]
    S --> M[mask: phone, OTP, account/card, email<br/>URLs kept intact]
    S --> X[extractUrls: http/s, bare domains,<br/>shorteners, wa.me]

    M --> G[services/gemini.js<br/>system instruction + JSON schema<br/>8 s timeout, LRU cache]
    G -->|valid JSON, spans verified| T[tactics, requested_actions,<br/>claimed_sender]
    G -->|timeout / error / invalid| L[Limited mode<br/>lib/heuristics.js keyword fallback]
    L --> T

    X --> UC[lib/urlCheck.js<br/>shortener, apk, non_https, TLD, IP,<br/>lookalike, bank_claim_not_bank_in, official_match]
    T -->|claimed_sender| UC

    T --> SC[lib/scorer.js<br/>high_risk / unable_to_verify / no_strong_indicators<br/>+ contributors]
    UC --> SC
    UC --> CC[lib/channelCompare.js<br/>claimed sender vs data/genuine.json]
    T --> CC
    CC -->|match = sender verified| SC

    SC --> R[Response: verdict, contributors, evidence,<br/>channel_compare, limited_mode, disclaimer]
    CC --> R

    U2[User: what have you already done?] --> AR[GET /api/actions/:state?lang=]
    AR --> AC[lib/actions.js<br/>data/actions.json cards, channels 1930 / portal / Chakshu]
```

## Modules

| Module | Role | Uses AI? |
|---|---|---|
| `lib/sanitize.js` | Validate input, mask PII before Gemini, extract URLs | No |
| `services/gemini.js` | Structured analysis of manipulation tactics | Yes |
| `lib/heuristics.js` | Keyword fallback, **limited mode only** | No |
| `lib/entities.js` | Read-only lookups over `data/genuine.json` | No |
| `lib/urlCheck.js` | Deterministic link signals | No |
| `lib/channelCompare.js` | Claimed sender vs official domains / SMS sender ID | No |
| `lib/scorer.js` | Rules → verdict + contributors | No |
| `lib/actions.js` | Vetted next-step cards from `data/actions.json` | No |
| `lib/analyze.js` | Orchestrates the pipeline (shared by the API and `scripts/eval.js`) | — |
| `routes/api.js`, `server.js` | HTTP, security headers, rate limiting, errors | — |

## Limited mode

If `GEMINI_API_KEY` is missing, or the Gemini call times out (8 s), errors, or returns JSON that fails the schema, `analyzeMessage` returns `null`. The pipeline then uses keyword pseudo-tactics and guesses the claimed sender from entity names in the text. In limited mode `requested_actions` comes from `detectRequestedActions`, which looks for three asks only: `share_otp`, `make_payment`, and `call_number` (a call/contact verb within 60 characters of a phone number). The patterns are kept narrow and skip negated phrases, because the first two are "dangerous" in the scorer. The response sets `limited_mode: true`. The URL engine, scorer and channel compare run the same way in both modes.

## Data ownership

`data/genuine.json` and `data/actions.json` are hand-verified and read-only at runtime. Gemini never produces domains, phone numbers or advice.
