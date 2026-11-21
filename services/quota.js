'use strict';

// Global daily cap on Gemini analyses (cost guardrail). In-memory, per
// process: resets at midnight IST and on restart. Cloud Run may run several
// instances, so the effective cap is GEMINI_DAILY_LIMIT x instances; keep
// max-instances low (see SECURITY.md).

const DEFAULT_DAILY_LIMIT = 300;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

let day = null;
let used = 0;

function limit() {
  const n = Number.parseInt(process.env.GEMINI_DAILY_LIMIT, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
}

/** Calendar date in India Standard Time (UTC+5:30), e.g. "2026-11-21". */
function istDate(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function roll(now) {
  const today = istDate(now);
  if (today !== day) {
    day = today;
    used = 0;
  }
}

/** Reserve one analysis. @returns true if under today's cap. */
function tryConsume(now = Date.now()) {
  roll(now);
  if (used >= limit()) return false;
  used += 1;
  return true;
}

function status(now = Date.now()) {
  roll(now);
  return { day, used, limit: limit() };
}

function _reset() {
  day = null;
  used = 0;
}

module.exports = { DEFAULT_DAILY_LIMIT, istDate, tryConsume, status, _reset };
