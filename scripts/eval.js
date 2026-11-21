#!/usr/bin/env node
'use strict';

// Runs every item in tests/fixtures/eval.json through the full pipeline and
// writes docs/EVAL.md. Real Gemini if GEMINI_API_KEY is set, else limited mode.

require('dotenv').config({ quiet: true, path: require('node:path').join(__dirname, '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { analyzeText } = require('../lib/analyze');
const { isConfigured, DEFAULT_MODEL } = require('../services/gemini');
const fixtures = require('../tests/fixtures/eval.json');

const OUT = path.join(__dirname, '..', 'docs', 'EVAL.md');
const DELAY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const useGemini = isConfigured();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  console.log(useGemini ? `Mode: Gemini (${model})` : 'Mode: limited (GEMINI_API_KEY not set)');

  const rows = [];
  for (const [i, item] of fixtures.items.entries()) {
    if (useGemini && i > 0) await sleep(DELAY_MS);
    const started = Date.now();
    const r = await analyzeText(item.text, { demoCache: false }); // never score pre-recorded answers
    const predictedScam = r.verdict === 'high_risk';
    const isScam = item.label === 'scam';
    const outcome = isScam ? (predictedScam ? 'TP' : 'FN') : predictedScam ? 'FP' : 'TN';
    rows.push({ ...item, verdict: r.verdict, limited: r.limited_mode, outcome, ms: Date.now() - started, contributors: r.contributors });
    console.log(`${item.id.padEnd(4)} ${item.label.padEnd(8)} ${r.verdict.padEnd(21)} ${outcome}${r.limited_mode ? ' (limited)' : ''}`);
  }

  const count = (o) => rows.filter((r) => r.outcome === o).length;
  const TP = count('TP');
  const TN = count('TN');
  const FP = count('FP');
  const FN = count('FN');
  const precision = TP + FP ? TP / (TP + FP) : 0;
  const recall = TP + FN ? TP / (TP + FN) : 0;
  const misclassified = rows.filter((r) => r.outcome === 'FP' || r.outcome === 'FN');
  const limitedCount = rows.filter((r) => r.limited).length;

  console.log(`\nTP=${TP} TN=${TN} FP=${FP} FN=${FN}  precision=${precision.toFixed(2)} recall=${recall.toFixed(2)}`);
  if (misclassified.length) console.log(`Misclassified: ${misclassified.map((r) => `${r.id} (${r.verdict})`).join(', ')}`);
  if (useGemini && limitedCount) console.log(`Warning: ${limitedCount} item(s) fell back to limited mode (Gemini call failed).`);

  fs.writeFileSync(OUT, render({ rows, TP, TN, FP, FN, precision, recall, misclassified, useGemini, model, limitedCount }));
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
}

function render({ rows, TP, TN, FP, FN, precision, recall, misclassified, useGemini, model, limitedCount }) {
  const date = new Date().toISOString().slice(0, 10);
  const mode = useGemini
    ? `Gemini (\`${model}\`)${limitedCount ? `; ${limitedCount} of ${rows.length} calls failed and used limited mode` : ''}`
    : 'Limited mode (no `GEMINI_API_KEY`): keyword heuristics + URL engine only';
  const lines = [];
  lines.push('# Evaluation', '');
  lines.push(`Last run: ${date}. Mode: ${mode}.`, '');
  lines.push('## Method', '');
  lines.push(
    '- Dataset: `tests/fixtures/eval.json`, 15 scam + 15 genuine messages (English, Assamese script, romanised Assamese, Hinglish), hand-labelled.',
    '- Each message runs through the same pipeline as `POST /api/analyze` (`lib/analyze.js`): sanitize, mask, Gemini analysis (or limited-mode heuristics), URL engine, scorer, channel compare.',
    '- Label rule: a scam is correct only if the verdict is `high_risk`. A genuine message is correct if it is anything except `high_risk` (`unable_to_verify` and `no_strong_indicators` both count).',
    '- Positive class = scam. TP = scam flagged `high_risk`; FN = scam not flagged; FP = genuine flagged `high_risk`; TN = genuine not flagged.',
    '- Reproduce: `npm run eval` (uses Gemini when `GEMINI_API_KEY` is set in `.env`, otherwise limited mode). Calls are spaced ~1 s apart.',
    '',
  );
  lines.push('## Results', '');
  lines.push('| | Predicted high_risk | Predicted not high_risk |', '|---|---|---|');
  lines.push(`| **Scam (15)** | TP = ${TP} | FN = ${FN} |`);
  lines.push(`| **Genuine (15)** | FP = ${FP} | TN = ${TN} |`, '');
  lines.push(`Precision ${precision.toFixed(2)}, recall ${recall.toFixed(2)}, accuracy ${((TP + TN) / rows.length).toFixed(2)}.`, '');
  if (!useGemini) {
    lines.push(
      '> **Read with caution:** this run used limited mode only, and the limited-mode keywords were written while looking at this dataset. The score shows the deterministic rules are consistent with the labels; it is not evidence of accuracy on unseen messages. Re-run with `GEMINI_API_KEY` set for the real pipeline.',
      '',
    );
  }

  lines.push('## Failures', '');
  if (misclassified.length === 0) {
    lines.push('None in this run.', '');
  } else {
    lines.push('| id | label | verdict | category | top contributors |', '|---|---|---|---|---|');
    for (const r of misclassified) {
      const top = r.contributors.slice(0, 3).map((c) => c.label.replace(/\|/g, '\\|')).join('; ') || 'none';
      lines.push(`| ${r.id} | ${r.label} | ${r.verdict} | ${r.category} | ${top} |`);
    }
    lines.push('');
  }

  lines.push('## All items', '');
  lines.push('| id | label | lang | category | verdict | outcome | mode |', '|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${r.id} | ${r.label} | ${r.lang} | ${r.category} | ${r.verdict} | ${r.outcome} | ${r.limited ? 'limited' : 'gemini'} |`);
  }
  lines.push('');

  lines.push('## Honest limitations', '');
  lines.push(
    '- **Tiny dataset.** 30 messages is a sanity check, not a benchmark. One item moves accuracy by about 3 points.',
    '- **Heuristics were written with this set in view.** The limited-mode keyword lists (`lib/heuristics.js`) were developed while looking at these fixtures, so limited-mode numbers are optimistic. Expect lower recall on unseen scams.',
    '- **Gemini is non-deterministic.** Results can change between runs and model versions even at low temperature. Responses are cached per process only.',
    '- **Messages are synthetic.** They are modelled on real formats with fictional numbers and domains. Real messages are messier: typos, mixed scripts, forwarded chains, screenshots.',
    '- **Entity coverage is limited.** `data/genuine.json` covers ~16 high-impersonation organisations. Lookalike and channel checks do nothing for brands outside that list.',
    '- **Lookalike matching is token-based**: a domain is flagged when one of its tokens equals a brand token (e.g. `sbi` in `sbi-kyc-verify.top`), so a legitimate third-party domain such as `sbi-news.com` would also be flagged.',
    '- **"Not high_risk" is not a clean bill of health.** `no_strong_indicators` always ships with a disclaimer and never says the message is genuine.',
    '',
  );
  lines.push('## Hard cases (from the dataset notes)', '');
  for (const h of fixtures.hard_cases_to_discuss_in_EVAL_md || []) {
    const id = h.match(/^[sg]\d+/);
    const row = id && rows.find((r) => r.id === id[0]);
    lines.push(`- ${h}${row ? ` **This run: ${row.verdict} (${row.outcome}).**` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((err) => {
  console.error(`Eval failed: ${err.message}`);
  process.exit(1);
});
