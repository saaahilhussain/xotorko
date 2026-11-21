#!/usr/bin/env node
'use strict';

// Records live Gemini analyses for the demo items into data/demo_cache.json.
// Needs GEMINI_API_KEY. Usage: node scripts/record-demo-cache.js [id ...]

require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const { sanitizeInput, mask } = require('../lib/sanitize');
const gemini = require('../services/gemini');
const { DEFAULT_PATH } = require('../services/demoCache');
const evalSet = require('../tests/fixtures/eval.json');

const items = Array.isArray(evalSet) ? evalSet : evalSet.items;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['s01', 's02', 's07'];

(async () => {
  let out = {};
  try {
    out = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8')) || {};
  } catch {
    out = {};
  }
  for (const id of ids) {
    const item = items.find((i) => i.id === id);
    if (!item) {
      console.error(`${id}: not in eval set`);
      continue;
    }
    const masked = mask(sanitizeInput(item.text).text);
    const analysis = await gemini.analyzeMessage(masked);
    if (!analysis) {
      console.error(`${id}: Gemini unavailable, not recorded`);
      continue;
    }
    const { tactics, ...rest } = analysis;
    out[id] = {
      recorded_on: new Date().toISOString().slice(0, 10),
      masked_text: masked,
      analysis: { ...rest, tactics: tactics.map(({ type, exact_span, explanation }) => ({ type, exact_span, explanation })) },
    };
    console.log(`${id}: recorded (${tactics.length} tactics)`);
  }
  fs.writeFileSync(DEFAULT_PATH, `${JSON.stringify(out, null, 2)}\n`);
})();
