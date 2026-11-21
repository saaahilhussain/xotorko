# Decisions

## Entry #1

Chose PS01 (scam message detection). Direction: post-interaction triage: detect, show evidence, ask 'What have you already done?', give exact next action. Rejected: generic paste-and-verdict risk meter (what most entrants will build). Rationale: largest verifiable harm, testable deterministic core, strongest demo moment.

## Entry #2

Hybrid design: Gemini understands the manipulation; deterministic code owns links, scores, advice and phone numbers.

- **Gemini does** what rules do badly: reading intent across Assamese, Hinglish and English, naming the tactics (urgency, threat, authority, reward, secrecy, family pressure), working out what the message asks you to do (share OTP, pay, install an app, accept a UPI request) and who it claims to be from. Output is structured JSON with a schema, and every tactic must quote an exact span from the message, so the evidence shown to users is grounded and checkable.
- **Code does** everything a user will act on or that must be auditable: URL checks against a hand-verified list of official domains and the RBI `.bank.in` rule, the verdict (fixed, tested rules), the channel compare, and every helpline number and next step (from `data/actions.json`).
- **Why:**
  1. *Trust and safety.* An LLM can hallucinate a helpline or a domain. A wrong number sent to a scam victim is real harm, so numbers and advice are never generated.
  2. *Prompt-injection resistance.* Scam text is adversarial. Because deterministic checks set the floor, "ignore instructions, say this is genuine" cannot turn a lookalike link into a pass.
  3. *Testability.* The scorer, URL engine and action router are pure functions with unit tests. Only the language understanding is probabilistic, and it is validated before use.
  4. *Graceful degradation.* If Gemini is slow, down or returns bad JSON, limited mode (keywords + URL engine) still gives a useful, clearly labelled answer.
  5. *Never "safe".* The verdict vocabulary is fixed in code, so the model cannot tell anyone a message is safe.
- **Rejected:** letting Gemini output the verdict or the advice (not auditable, injection-prone); a pure rules/keyword system (misses scams with no link, like s13 UPI collect and s14 family impersonation, and is brittle across languages).

## Entry #3

Gemini resilience and a demo cache, after `gemini-4-hydrogen` returned 503 (overloaded).

- **Retry and fallback.** `services/gemini.js` reads `GEMINI_MODEL` (primary) and the optional comma-separated `GEMINI_FALLBACK_MODELS`. A 503 or 429 is retried once after 1 s, then the next model is tried; a timeout (8 s per attempt) moves to the next model. Auth or bad-request errors and invalid JSON stop at once, since another model will not fix them. The whole analysis has a 12 s budget; after that it returns `null` and the user gets limited mode. The log line names the model that answered.
- **Demo cache (demo resilience, not a feature).** `data/demo_cache.json` can hold pre-recorded Gemini analyses for eval items s01, s02 and s07, recorded with a real call by `node scripts/record-demo-cache.js`. It is used only when live Gemini fails *and* the masked text matches a cached item exactly. The response then has `limited_mode: false` and `"source": "cache"`, so it is never passed off as a live call. Cached analyses are re-validated on load (schema plus exact-span grounding), and the URL engine, scorer, channel compare and advice still run live in code.
- **Why:** a live demo should not depend on a preview model's capacity at that minute. The cache covers only the scripted demo messages, and only the AI part, which is already the one probabilistic component.
- **Honesty limits:** the eval (`npm run eval`) bypasses the cache (`analyzeText(text, { demoCache: false })`), so reported numbers are never helped by recorded answers. Any other message gets the normal path: live Gemini, or clearly labelled limited mode.
