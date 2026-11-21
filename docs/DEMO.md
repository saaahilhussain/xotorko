# Demo (90 seconds)

**Before you start:** run `npm start` and open `http://localhost:8080` on a phone-sized window (375px). Check that `GEMINI_API_KEY` is set. If Gemini is overloaded, the app tries the fallback models (`GEMINI_FALLBACK_MODELS`). For s01, s02 and s07 it then uses the recorded demo cache (`node scripts/record-demo-cache.js` beforehand), and the result shows the badge "AI result from a saved demo recording". Any other message falls back to limited mode with the badge "AI unavailable: rule-based check only".

| Time | Do | Say |
|---|---|---|
| 0:00 | Show the page. Tap **অসমীয়া** in the language bar. | "Xotorko, সতৰ্ক: 'alert' in Assamese. Most scam tools are English-only; the people targeted here often read Assamese." |
| 0:10 | Tap the example chip **বিদ্যুতৰ বিল (অসমীয়া)** (s02, the Assamese electricity cut-off scam). Tap **বাৰ্তা পৰীক্ষা কৰক**. | "A real pattern: 'your power will be cut tonight, call this number'." |
| 0:20 | The result opens with focus on its heading. Point at the marked phrases: **তাড়াহুৰা (URGENCY)** on "আজি নিশা" and **ভাবুকি (THREAT)** on "বিচ্ছিন্ন". | "Evidence first: every highlight is an exact phrase from the message, with a text label, not just a colour." |
| 0:30 | Scroll through the three evidence columns, then the verdict banner **উচ্চ বিপদ / High risk**. | "The AI reads the language; the verdict comes from fixed, tested rules. It never says 'safe'." |
| 0:40 | Under **আপুনি ইতিমধ্যে কি কৰিছে? (What have you already done?)** tap **টকা পঠিয়াইছোঁ (Paid money)**. | "Most tools stop at the verdict. Victims need to know what to do next." |
| 0:50 | The red **critical** card: "এতিয়াই 1930 ত ফোন কৰক". Point at the **📞 1930** tap-to-call button and the cybercrime.gov.in link. | "Call 1930 first: fast reporting can hold money that is still in the scammer's account. These numbers come from a vetted file, never from the AI." |
| 1:05 | Tap **ঘটনাৰ ৰিপৰ্ট কপি কৰক (Copy incident report)**; "কপি হ’ল" is announced. Open **Show the report text**. | "A ready-made report: sender, tactics, defanged links, verdict and time, to paste into the bank or 1930 complaint." |
| 1:15 | Tap **WhatsApp ত পৰিয়ালক সতৰ্ক কৰক (Warn family)**. WhatsApp opens with a short warning in Assamese. | "One tap to warn family, in their language. Any link is defanged (hxxps, [.]) so nobody can tap it." |
| 1:25 | Optional: switch to EN and run the **SBI KYC link** chip to show the Official Channel Compare card ("Does not match" sbi.bank.in). | "Close: evidence, a verdict that never says 'safe', and the exact next step." |

**Backup:** s01 is the English version of the same electricity scam. Paste it if you want to demo in English.

**Keyboard-only check (if asked about accessibility):** Tab goes to the skip link, then the language buttons, the textarea, the example chips and Check. Enter submits, and focus moves to the result heading. Tab on to a state button and press Enter: focus moves to the action-card heading.
