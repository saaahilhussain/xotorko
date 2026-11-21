# Xotorko (সতৰ্ক)

**Check a suspicious message. Know what to do next.** Paste an SMS or WhatsApp message in Assamese, Hindi or English. Xotorko shows the evidence, gives a verdict that never says "safe", then asks *"What have you already done?"* and gives the exact next step: 1930, your bank, or Chakshu.

**Live:** https://xotorko-359115993544.asia-south1.run.app · **Repo:** https://github.com/saaahilhussain/xotorko · MIT licence

## Problem (PS01)

Scam detectors stop at "this looks like a scam". The harm happens next: the person has already clicked, shared an OTP or paid, and doesn't know which of several channels to use. Xotorko does **post-interaction triage**, and its advice is code-owned and sourced ([docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)):

- **Money lost → call 1930 at once**, then file at cybercrime.gov.in (MHA / I4C). **No money lost → report on Chakshu** (Sanchar Saathi), which handles suspected fraud communication only. Sending someone to the wrong channel wastes the minutes in which funds can still be held.
- **Banks are moving to `.bank.in`** (RBI circular RBI/2025-26/28). A "bank" link on any other domain is a strong signal.
- **APDCL sends genuine SMS only from sender ID DAPDCL.** Fake "power cut tonight" messages, often in Assamese, are one of the most common local scams.

## How it works

**Gemini understands the trick; code decides the advice.** Gemini reads the message (Assamese, Hinglish, English) and returns structured JSON: the tactics it finds, each with an exact quote from the message, plus what the message asks for and who it claims to be from. Deterministic code checks the links, sets the verdict, compares the claimed sender with official channels, and chooses every phone number and step. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md).

```
message → sanitize → mask PII → Gemini (or rules in limited mode) ┐
                     └→ URL engine (lexical, links never fetched) ┴→ scorer → verdict + evidence
"What have you already done?" → vetted action card (data/actions.json, en/as/hi)
```

## Built with

- **Google Antigravity** for development.
- **Gemini** (`gemini-4-hydrogen` via `@google/genai`): JSON schema output, retry on 503/429, fallback models (`GEMINI_FALLBACK_MODELS`), a 12 s budget, and a [demo cache](docs/DECISIONS.md) for the scripted demo messages.
- **Google Cloud Run** (asia-south1), Node 24, Express 5, helmet. Plain HTML, CSS and JS with no framework.

## Run locally

```bash
npm ci
cp .env.example .env          # add GEMINI_API_KEY; without it the app runs in limited mode
npm start                     # http://localhost:8080
npm test                      # 183 tests
npm run lint                  # ESLint
npm run test:coverage         # coverage report
npm run eval                  # real-model eval → docs/EVAL.md (uses API credits)
```

**Coverage:** 96.4% statements, 86.5% branches, 99.3% functions, 98.5% lines. This covers `lib/`, `services/`, `routes/`, `server.js` and `public/lib.js`. `public/app.js` is DOM code, checked with headless Chrome (end-to-end flow plus axe) rather than Jest.

## Evaluation

Real model, 30 hand-labelled messages (15 scam, 15 genuine; English, Assamese script, romanised Assamese, Hinglish). Full report: [docs/EVAL.md](docs/EVAL.md).

| TP | TN | FP | FN | Precision | Recall |
|---|---|---|---|---|---|
| 14 | 14 | 1 | 1 | 0.93 | 0.93 |

- **Latency:** not recorded in this run. Each call is bounded by an 8 s per-attempt timeout and a 12 s total budget, after which limited mode answers.
- **s11 (missed scam, job offer):** the reward phrase and the requests to open a link and message on WhatsApp are each weak signals. By design, one tactic plus weak asks gives `unable_to_verify`, not `high_risk`. Task scams ask for money only later in the chat, so the first message carries no "dangerous" ask. The user still sees "Couldn't verify" with evidence, never a clean result.
- **g12 (false alarm, Jio recharge reminder):** Gemini read "Recharge via MyJio app" as a payment request. With no link to compare, the sender can't be verified, and the scorer treats any payment request from an unverified sender as high risk. This is a deliberate trade: we would rather over-warn on a bill than miss a "pay now" scam.
- These two are documented, not tuned away: changing the rules to fit 30 messages would overfit.
- **Since the eval:** `maxOutputTokens` 1024 and limited-mode request detection were added. The Gemini-path logic is unchanged, and limited mode was checked locally on the same fixtures (15/15 scams flagged, 0 false alarms; optimistic, because the rules were written with this set in view).

## How it meets each criterion

| Criterion | Where |
|---|---|
| **Code Quality** | Small pure modules with one job each: `lib/sanitize.js`, `lib/urlCheck.js`, `lib/scorer.js`, `lib/channelCompare.js`, `lib/actions.js`, orchestrated by `lib/analyze.js`, which the API and `scripts/eval.js` share. Code-owned data lives in `data/*.json`. The frontend splits pure helpers (`public/lib.js`, `public/i18n.js`) from DOM code (`public/app.js`). Decisions are recorded in `docs/DECISIONS.md`. ESLint flat config (`eslint.config.js`, `npm run lint`), and GitHub Actions CI (`.github/workflows/ci.yml`) runs lint and tests on every push and pull request to `main`. |
| **Security** | PII masked before Gemini (`lib/sanitize.js`). Strict CSP and helmet; no inline code; DOM built only with `textContent`. Links are never fetched and always shown defanged. Rate limits of 10/min for analyze and 30/min for the rest of the API. Body limit 10 kb, nothing stored. The scorer, not the model, sets the verdict (prompt-injection resistant). `npm audit` is clean and no secrets are in git history. The Gemini key is stored in Google Secret Manager and injected with `--set-secrets` (`docs/PROMPTS.md`). See [SECURITY.md](SECURITY.md), including the threat model. |
| **Efficiency** | One Gemini call per message, with `maxOutputTokens` 1024 and LOW thinking. In-memory LRU cache. Daily cap `GEMINI_DAILY_LIMIT` (`services/quota.js`). 12 s budget, then retry and fallback (`services/gemini.js`). Page is about 70 KB with no fonts or CDNs, gzip, and content-hash asset URLs with one-day caching (`server.js`). Lighthouse performance is 100. Cloud Run `--min-instances 1` avoids cold starts, and `--max-instances 2` bounds cost. |
| **Testing** | 183 Jest tests in 16 files: scorer, URL engine, heuristics in 3 languages, the retry/fallback/budget/cap paths, rate limits, CSP and landmarks, translation integrity (facts unchanged, Assamese ৰ/ৱ, never "safe"), and defang/report/warning builders. Coverage is 96% of statements. The real-model eval is `scripts/eval.js`. |
| **Accessibility** | WCAG 2.1 AA. Semantic landmarks, skip link and labelled controls. Status in aria-live; focus moves to the result and then the action card. Labels are text, not colour alone; contrast is at least 6.2:1. `lang` follows the language toggle; reduced motion is respected; tap targets are at least 44 px. **Lighthouse accessibility 100** (mobile and desktop) and **axe-core: 0 violations** in 24 scans (3 languages × 4 UI states × 375/1280 px). Method below. |
| **Problem Statement Alignment** | PS01 scam detection, extended to what victims need next: evidence highlighted in the message, an official-channel comparison (`data/genuine.json`), a verdict, then "What have you already done?" → vetted steps (1930 vs Chakshu vs bank), a copyable incident report and a defanged WhatsApp warning for family. Assamese-first for Assam, plus Hindi and English. |

**Accessibility method (2026-11-21):** Lighthouse 12.2 (accessibility, best practices and performance, mobile and desktop presets) on the landing page. axe-core 4.10 (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, best-practice) injected via the Chrome DevTools Protocol after each interaction, because Lighthouse sees only the initial page. Keyboard-only run-through: skip link → language → textarea → examples → Check → result heading → state buttons → action-card heading. Contrast was computed for every colour pair in `public/styles.css`.

## Known limitations

- **Small eval:** 30 synthetic messages are a sanity check, not a benchmark.
- **Limited-mode rules** were written with the eval set in view, so expect weaker recall on new scam formats when Gemini is unavailable.
- **Entity list:** `data/genuine.json` covers about 16 high-impersonation organisations. Senders outside it get generic link checks only.
- **Translations:** the Assamese and Hindi text has not yet been reviewed by native speakers. Server-written explanations are in English.
- **Per-instance counters:** the daily cap and rate limits are counted in memory per instance and reset on restart.
- **Text only:** no screenshots, voice calls or forwarded-chain parsing.
- **No guarantees:** "No strong scam signs found" always comes with a disclaimer. Xotorko never says a message is safe.

Demo script: [docs/DEMO.md](docs/DEMO.md). Security: [SECURITY.md](SECURITY.md).
