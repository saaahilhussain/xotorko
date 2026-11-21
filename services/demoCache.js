'use strict';

// Demo resilience: pre-recorded Gemini analyses for a few eval items, served
// only when live Gemini fails AND the masked text matches exactly. See
// docs/DECISIONS.md (entry #3). Record with: node scripts/record-demo-cache.js

const fs = require('node:fs');
const path = require('node:path');
const { validateAnalysis } = require('./gemini');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'demo_cache.json');

let entries = null; // Map maskedText -> analysis

/**
 * Load cache entries. File shape: { "<id>": { "masked_text": "...", "analysis": {...} } }.
 * A missing, empty or malformed file yields an empty cache (never throws).
 */
function load(file = DEFAULT_PATH) {
  const map = new Map();
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    raw = {};
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw)) {
      if (!entry || typeof entry.masked_text !== 'string') continue;
      // Re-validate so a hand-edited file can't bypass the grounding rules.
      const analysis = validateAnalysis(entry.analysis, entry.masked_text);
      if (analysis) map.set(entry.masked_text, analysis);
    }
  }
  entries = map;
  return map;
}

/** @returns analysis for an exact masked-text match, or null */
function lookup(maskedText) {
  if (!entries) load();
  return entries.get(maskedText) || null;
}

function size() {
  if (!entries) load();
  return entries.size;
}

module.exports = { DEFAULT_PATH, load, lookup, size };
