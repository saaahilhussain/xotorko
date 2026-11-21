# Demo (90 seconds)

## Before you start

- Open the live URL (or `npm start` → http://localhost:8080) in a phone-sized window (375 px).
- Copy this message to the clipboard. It is eval item s03, a romanised-Assamese APDCL scam with a fake link:

  ```
  APDCL: apunar bijuli line aji rati kati dia hobo. KYC update koribole ei link ot click korok http://apdcl-kyc-update.xyz/pay
  ```

- Have WhatsApp (web or phone) signed in, so the "Warn family" step opens straight away.

## The path

| Time | Do | Say |
|---|---|---|
| 0:00 | Tap **অসমীয়া** in the language bar. The whole UI switches and `<html lang>` becomes `as`. | "Xotorko, সতৰ্ক: 'alert' in Assamese. Scam tools are English-first; the people targeted here often aren't." |
| 0:08 | Paste the s03 message and tap **বাৰ্তা পৰীক্ষা কৰক**. | "A fake APDCL 'power cut tonight' message, one of the most common scams in Assam." |
| 0:15 | The result opens with focus on its heading. Point at the compact line **উচ্চ বিপদ · কিয় চাওক** and the marked phrases (urgency on "aji rati", threat on "kati dia", plus KYC; the live model may mark slightly different phrases). | "Evidence first. Every highlight is an exact phrase from the message, labelled in text, not just colour." |
| 0:28 | Scroll to **Link evidence**: one block for `apdcl-kyc-update[.]xyz` with its reasons. Then the **official channel check**: claims APDCL, link `apdcl-kyc-update[.]xyz`, official domain `apdcl.org`, **✗ মিল নাই (does not match)**, official SMS sender ID **DAPDCL**. | "We never open the link; we compare it with the official domain from a hand-checked list. Real APDCL texts come only from DAPDCL." |
| 0:42 | The full verdict banner: **উচ্চ বিপদ / High risk**. | "The AI reads the language. Fixed, tested rules decide the verdict, and it never says 'safe'." |
| 0:48 | Under **আপুনি ইতিমধ্যে কি কৰিছে?** tap **টকা পঠিয়াইছোঁ (Paid money)**. Focus jumps to the card. | "Most tools stop at the verdict. A victim needs the next step." |
| 0:55 | The red **critical** card, in Assamese: call 1930 now. Point at the **📞 1930** tap-to-call button, the bank step and the cybercrime.gov.in link. | "Money lost means 1930 first: fast reporting can hold funds still in the scammer's account. Not money lost means Chakshu, a different channel. These numbers come from a vetted file, never from the AI." |
| 1:08 | Tap **ঘটনাৰ ৰিপৰ্ট কপি কৰক (Copy incident report)**. "কপি হ’ল" is announced. Open **Show the report text**. | "A ready-made report with sender, tactics, the defanged link, verdict and time, for the bank or the 1930 complaint." |
| 1:18 | Tap **WhatsApp ত পৰিয়ালক সতৰ্ক কৰক (Warn family)**. WhatsApp opens with a short Assamese warning. | "One tap warns the family, in their language. The link is defanged (hxxp, [.]) so nobody can tap it." |
| 1:28 | Close. | "Evidence, a verdict that never says safe, and the exact next step." |

## If the AI is slow or down

- The app retries a 503/429 once, tries any `GEMINI_FALLBACK_MODELS`, and after **12 s** answers with rules only. The badge reads "AI unavailable: rule-based check only". **s03 still works in rules-only mode:** highlights, channel check, High risk and the 1930 card are all deterministic.
- **Recorded examples (demo cache):** s01, s02 and s07 have saved Gemini answers in `data/demo_cache.json`. They are used only when the live call fails, and are labelled "AI result from a saved demo recording".
  - **s02** is the example chip **বিদ্যুতৰ বিল (অসমীয়া)**: Assamese script with highlights on the threat and "লগে লগে", then High risk. It has no link or named sender, so there is no channel card.
  - **s07** is the English APDCL "bill update app" with an `.apk` link. It shows the channel check (apdcl.org, DAPDCL) and asks you to install an app.
  - **s01** is the English version of s02.
- **To skip the wait entirely** (for example on bad venue Wi-Fi), run the local copy with `GEMINI_API_KEY` unset. Gemini is then skipped at once, s01/s02/s07 answer instantly from the recording, and everything else uses rules.
- Fallback order for the same story: **s02 chip** (Assamese highlights → High risk) → **Paid money** → 1930 card → Copy report → Warn family, then paste **s07** to show the channel check.

## Keyboard-only check (if asked about accessibility)

Tab reaches the skip link, then the language buttons, the textarea, the example chips and Check. Enter submits, and focus moves to "What we found". Tab on to "see why", which jumps to the banner, then to a state button. Enter loads the card and moves focus to its heading; then come the call and portal links, Copy report and Warn family.
