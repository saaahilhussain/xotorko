'use strict';

const MAX_LENGTH = 2000;

// Control characters except tab (\t), newline (\n) and carriage return (\r).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Validate and normalise raw user input.
 * @returns {{ ok: true, text: string } | { ok: false, error: string }}
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Message text must be a string.' };
  }
  const text = input.normalize('NFC').replace(CONTROL_CHARS, '').trim();
  if (text.length === 0) {
    return { ok: false, error: 'Message text is empty.' };
  }
  if (text.length > MAX_LENGTH) {
    return { ok: false, error: `Message is too long (max ${MAX_LENGTH} characters).` };
  }
  return { ok: true, text };
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

const KNOWN_TLDS = [
  // generic
  'com', 'org', 'net', 'info', 'biz', 'io', 'co', 'me', 'app', 'dev', 'ai', 'in', 'us', 'uk',
  // used by shorteners / messaging
  'ly', 'gl', 'gd', 'at', 'cc', 'id', 'to', 'me',
  // brand TLD in genuine.json (onlinesbi.sbi)
  'sbi',
  // abused TLDs (mirrors data/genuine.json suspicious_tlds)
  'xyz', 'top', 'click', 'link', 'live', 'shop', 'buzz', 'icu', 'online', 'site', 'rest',
  'cfd', 'sbs', 'monster', 'zip', 'mov', 'vip', 'club', 'win', 'tk', 'ml', 'ga', 'cf', 'gq',
];

const TLD_ALT = [...new Set(KNOWN_TLDS)].sort((a, b) => b.length - a.length).join('|');

// Explicit http(s) URLs.
const SCHEME_URL = /https?:\/\/[^\s<>"'`]+/gi;
// Bare domains such as sbi-kyc.xyz/path, bit.ly/abc, wa.me/91..., www.example.com.
// Not preceded by '@' (emails / UPI IDs), '/', '.', '-' or a word character.
const BARE_URL = new RegExp(
  `(?<![\\w@./-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLD_ALT})(?![a-z0-9-])(?:[/?#][^\\s<>"'\`]*)?`,
  'gi',
);
// IPv4 hosts without scheme, e.g. 192.168.1.10/login.
const BARE_IP = /(?<![\w@./-])(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[/?#][^\s<>"'`]*)?(?![\w.])/g;

const TRAILING_PUNCT = /[.,;:!?)\]}'"।]+$/u;

function stripTrailing(url) {
  return url.replace(TRAILING_PUNCT, '');
}

/** Return [start, end) spans of every URL-like token in text. */
function urlSpans(text) {
  const spans = [];
  const add = (re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const cleaned = stripTrailing(m[0]);
      const start = m.index;
      const end = start + cleaned.length;
      if (cleaned.length === 0) continue;
      if (spans.some((s) => start < s.end && end > s.start)) continue; // overlap: keep first
      spans.push({ start, end, value: cleaned });
    }
  };
  add(SCHEME_URL);
  add(BARE_URL);
  add(BARE_IP);
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Extract URLs, bare domains, shortener links and wa.me links, in order of
 * appearance, de-duplicated. Returned exactly as written in the message.
 */
function extractUrls(text) {
  if (typeof text !== 'string') return [];
  const seen = new Set();
  const out = [];
  for (const { value } of urlSpans(text)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Masking (runs before anything is sent to Gemini)
// ---------------------------------------------------------------------------

const PLACEHOLDERS = Object.freeze({
  email: '[EMAIL]',
  phone: '[PHONE]',
  account: '[ACCOUNT]',
  code: '[CODE]',
});

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// Indian mobile numbers: optional +91 / 91 / 0 prefix, 10 digits starting 6-9,
// optionally split 5+5 by a space or hyphen.
const PHONE = /(?<![\w+])(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\w])/g;
// Card numbers written in groups of four.
const CARD_GROUPED = /(?<![\w])\d{4}([\s-])\d{4}\1\d{4}\1\d{1,6}(?![\w])/g;
// Plain 9-18 digit account / card / reference numbers (incl. 10-digit non-mobile).
const ACCOUNT = /(?<![\w])\d{9,18}(?![\w])/g;
// 4-8 digit OTP-like codes. Skips amounts (Rs 4999), dates/times (2026-11, 10:30)
// and numbers glued to other digits or punctuation.
const CODE = /(?<![\w,:/-]|\d\.)(?<!(?:rs|inr|₹)\.?\s?)\d{4,8}(?![\w,:/-]|\.\d)/gi;

function maskSegment(segment) {
  return segment
    .replace(EMAIL, PLACEHOLDERS.email)
    .replace(PHONE, PLACEHOLDERS.phone)
    .replace(CARD_GROUPED, PLACEHOLDERS.account)
    .replace(ACCOUNT, PLACEHOLDERS.account)
    .replace(CODE, PLACEHOLDERS.code);
}

/**
 * Replace phone numbers, OTP-like codes, account/card numbers and email
 * addresses with placeholders. URLs are left intact so the link engine and
 * Gemini see exactly what the user saw.
 */
function mask(text) {
  if (typeof text !== 'string' || text.length === 0) return '';
  // Emails look like bare domains to the URL matcher, so protect them first.
  const spans = urlSpans(text).filter((s) => text[s.start - 1] !== '@');
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    // If the URL is the domain half of an email we already filtered it above.
    out += maskSegment(text.slice(cursor, s.start));
    out += text.slice(s.start, s.end);
    cursor = s.end;
  }
  out += maskSegment(text.slice(cursor));
  return out;
}

module.exports = { MAX_LENGTH, PLACEHOLDERS, sanitizeInput, mask, extractUrls };
