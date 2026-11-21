# Data sources (checked 2026-11-21)

All advice, phone numbers and official domains in `data/` are code-owned and hand-verified. Gemini never generates them.

| Fact | Source |
|---|---|
| 1930 is the national cyber financial fraud helpline; call immediately after money is lost | MHA / I4C; Sanchar Saathi advisory ("If fraud has already occurred: report at cybercrime.gov.in or call 1930") |
| cybercrime.gov.in is the National Cyber Crime Reporting Portal | MHA; NCRP |
| Chakshu (sancharsaathi.gov.in/sfc) is for *suspected* fraud communication; if money is lost use 1930 / cybercrime.gov.in | DoT Sanchar Saathi; HDFC Bank reporting guide (communication within last 30 days) |
| Banks moved to `.bank.in`, exclusive to RBI-regulated banks, deadline 31 Oct 2025 | RBI circular RBI/2025-26/28 (22 Apr 2025); PIB Fact Check list (sbi.bank.in, hdfc.bank.in, icici.bank.in, axis.bank.in, pnb.bank.in, kotak.bank.in) |
| Report unauthorised transactions to the bank as early as possible; delay raises risk of loss | RBI Customer Protection circular RBI/2017-18/15 |
| APDCL genuine SMS come only from sender ID DAPDCL; APDCL warned about fake disconnection SMS | India Today NE, May 2024 (APDCL advisory) |
| APDCL helpline 1912; official domain apdcl.org | Assam Power Department site; district sites (@apdcl.org email) |
| DoT/TRAI do not authorise calls threatening mobile disconnection | Sanchar Saathi advisory |

Entries marked `"status": "verify"` in `genuine.json` are well-known domains not re-checked today. Open each once before the demo.

Limits: this list covers ~16 high-impersonation entities, not every organisation in India. Unknown senders fall back to generic link checks and Gemini analysis.
