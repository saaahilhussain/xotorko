# Evaluation

Last run: 2026-11-21. Mode: Limited mode (no `GEMINI_API_KEY`): keyword heuristics + URL engine only.

## Method

- Dataset: `tests/fixtures/eval.json`, 15 scam + 15 genuine messages (English, Assamese script, romanised Assamese, Hinglish), hand-labelled.
- Each message runs through the same pipeline as `POST /api/analyze` (`lib/analyze.js`): sanitize, mask, Gemini analysis (or limited-mode heuristics), URL engine, scorer, channel compare.
- Label rule: a scam is correct only if the verdict is `high_risk`. A genuine message is correct if it is anything except `high_risk` (`unable_to_verify` and `no_strong_indicators` both count).
- Positive class = scam. TP = scam flagged `high_risk`; FN = scam not flagged; FP = genuine flagged `high_risk`; TN = genuine not flagged.
- Reproduce: `npm run eval` (uses Gemini when `GEMINI_API_KEY` is set in `.env`, otherwise limited mode). Calls are spaced ~1 s apart.

## Results

| | Predicted high_risk | Predicted not high_risk |
|---|---|---|
| **Scam (15)** | TP = 15 | FN = 0 |
| **Genuine (15)** | FP = 0 | TN = 15 |

Precision 1.00, recall 1.00, accuracy 1.00.

> **Read with caution:** this run used limited mode only, and the limited-mode keywords were written while looking at this dataset. The score shows the deterministic rules are consistent with the labels; it is not evidence of accuracy on unseen messages. Re-run with `GEMINI_API_KEY` set for the real pipeline.

## Failures

None in this run.

## All items

| id | label | lang | category | verdict | outcome | mode |
|---|---|---|---|---|---|---|
| s01 | scam | en | electricity | high_risk | TP | limited |
| s02 | scam | as | electricity | high_risk | TP | limited |
| s03 | scam | as-latn | electricity | high_risk | TP | limited |
| s04 | scam | en | bank_kyc | high_risk | TP | limited |
| s05 | scam | hi-latn | bank_kyc | high_risk | TP | limited |
| s06 | scam | en | parcel | high_risk | TP | limited |
| s07 | scam | en | apk | high_risk | TP | limited |
| s08 | scam | en | lottery | high_risk | TP | limited |
| s09 | scam | en | digital_arrest | high_risk | TP | limited |
| s10 | scam | en | telecom | high_risk | TP | limited |
| s11 | scam | en | job | high_risk | TP | limited |
| s12 | scam | en | refund | high_risk | TP | limited |
| s13 | scam | en | upi_collect | high_risk | TP | limited |
| s14 | scam | as | family_impersonation | high_risk | TP | limited |
| s15 | scam | en | otp_request | high_risk | TP | limited |
| g01 | genuine | en | otp | no_strong_indicators | TN | limited |
| g02 | genuine | en | debit_alert | no_strong_indicators | TN | limited |
| g03 | genuine | en | electricity | no_strong_indicators | TN | limited |
| g04 | genuine | en | credit_alert | no_strong_indicators | TN | limited |
| g05 | genuine | en | parcel | no_strong_indicators | TN | limited |
| g06 | genuine | en | aadhaar | no_strong_indicators | TN | limited |
| g07 | genuine | en | delivery | no_strong_indicators | TN | limited |
| g08 | genuine | as | family | no_strong_indicators | TN | limited |
| g09 | genuine | en | railway | no_strong_indicators | TN | limited |
| g10 | genuine | en | otp | no_strong_indicators | TN | limited |
| g11 | genuine | hi-latn | personal | no_strong_indicators | TN | limited |
| g12 | genuine | en | telecom | no_strong_indicators | TN | limited |
| g13 | genuine | en | bank_info | no_strong_indicators | TN | limited |
| g14 | genuine | en | epfo | no_strong_indicators | TN | limited |
| g15 | genuine | en | appointment | no_strong_indicators | TN | limited |

## Honest limitations

- **Tiny dataset.** 30 messages is a sanity check, not a benchmark. One item moves accuracy by about 3 points.
- **Heuristics were written with this set in view.** The limited-mode keyword lists (`lib/heuristics.js`) were developed while looking at these fixtures, so limited-mode numbers are optimistic. Expect lower recall on unseen scams.
- **Gemini is non-deterministic.** Results can change between runs and model versions even at low temperature. Responses are cached per process only.
- **Messages are synthetic.** They are modelled on real formats with fictional numbers and domains. Real messages are messier: typos, mixed scripts, forwarded chains, screenshots.
- **Entity coverage is limited.** `data/genuine.json` covers ~16 high-impersonation organisations. Lookalike and channel checks do nothing for brands outside that list.
- **Lookalike matching is substring-based**, so a legitimate third-party domain that contains a brand name (e.g. a news site about SBI) would be flagged.
- **"Not high_risk" is not a clean bill of health.** `no_strong_indicators` always ships with a disclaimer and never says the message is genuine.

## Hard cases (from the dataset notes)

- s13 (UPI collect) and s15 (OTP request over call) have no link: tests that Gemini reasoning, not URL rules, carries the verdict. **This run: high_risk (TP).**
- s14 (family impersonation, Assamese) has no link and no organisation: pure social engineering. **This run: high_risk (TP).**
- g02 contains a VPA and 'Not you? Call': genuine but superficially similar to scams; tests false positives. **This run: no_strong_indicators (TN).**
- g13 mentions OTP/PIN/password but as a warning: tests that keywords alone don't trigger high_risk. **This run: no_strong_indicators (TN).**
