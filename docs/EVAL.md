# Evaluation

Last run: 2026-11-21. Mode: Gemini (`gemini-4-hydrogen`).

## Method

- Dataset: `tests/fixtures/eval.json`, 15 scam + 15 genuine messages (English, Assamese script, romanised Assamese, Hinglish), hand-labelled.
- Each message runs through the same pipeline as `POST /api/analyze` (`lib/analyze.js`): sanitize, mask, Gemini analysis (or limited-mode heuristics), URL engine, scorer, channel compare.
- Label rule: a scam is correct only if the verdict is `high_risk`. A genuine message is correct if it is anything except `high_risk` (`unable_to_verify` and `no_strong_indicators` both count).
- Positive class = scam. TP = scam flagged `high_risk`; FN = scam not flagged; FP = genuine flagged `high_risk`; TN = genuine not flagged.
- Reproduce: `npm run eval` (uses Gemini when `GEMINI_API_KEY` is set in `.env`, otherwise limited mode). Calls are spaced ~1 s apart.

## Results

| | Predicted high_risk | Predicted not high_risk |
|---|---|---|
| **Scam (15)** | TP = 14 | FN = 1 |
| **Genuine (15)** | FP = 1 | TN = 14 |

Precision 0.93, recall 0.93, accuracy 0.93.

## Failures

| id | label | verdict | category | top contributors |
|---|---|---|---|---|
| s11 | scam | unable_to_verify | job | Asks you to call or message a number; Asks you to open a link; Promise of reward: "Earn Rs 3000-8000 daily" |
| g12 | genuine | high_risk | telecom | Asks you to send money (sender not verified) |

## All items

| id | label | lang | category | verdict | outcome | mode |
|---|---|---|---|---|---|---|
| s01 | scam | en | electricity | high_risk | TP | gemini |
| s02 | scam | as | electricity | high_risk | TP | gemini |
| s03 | scam | as-latn | electricity | high_risk | TP | gemini |
| s04 | scam | en | bank_kyc | high_risk | TP | gemini |
| s05 | scam | hi-latn | bank_kyc | high_risk | TP | gemini |
| s06 | scam | en | parcel | high_risk | TP | gemini |
| s07 | scam | en | apk | high_risk | TP | gemini |
| s08 | scam | en | lottery | high_risk | TP | gemini |
| s09 | scam | en | digital_arrest | high_risk | TP | gemini |
| s10 | scam | en | telecom | high_risk | TP | gemini |
| s11 | scam | en | job | unable_to_verify | FN | gemini |
| s12 | scam | en | refund | high_risk | TP | gemini |
| s13 | scam | en | upi_collect | high_risk | TP | gemini |
| s14 | scam | as | family_impersonation | high_risk | TP | gemini |
| s15 | scam | en | otp_request | high_risk | TP | gemini |
| g01 | genuine | en | otp | no_strong_indicators | TN | gemini |
| g02 | genuine | en | debit_alert | no_strong_indicators | TN | gemini |
| g03 | genuine | en | electricity | no_strong_indicators | TN | gemini |
| g04 | genuine | en | credit_alert | no_strong_indicators | TN | gemini |
| g05 | genuine | en | parcel | no_strong_indicators | TN | gemini |
| g06 | genuine | en | aadhaar | no_strong_indicators | TN | gemini |
| g07 | genuine | en | delivery | no_strong_indicators | TN | gemini |
| g08 | genuine | as | family | no_strong_indicators | TN | gemini |
| g09 | genuine | en | railway | no_strong_indicators | TN | gemini |
| g10 | genuine | en | otp | no_strong_indicators | TN | gemini |
| g11 | genuine | hi-latn | personal | no_strong_indicators | TN | gemini |
| g12 | genuine | en | telecom | high_risk | FP | gemini |
| g13 | genuine | en | bank_info | no_strong_indicators | TN | gemini |
| g14 | genuine | en | epfo | no_strong_indicators | TN | gemini |
| g15 | genuine | en | appointment | no_strong_indicators | TN | gemini |

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
