'use strict';

// Keyword fallback used ONLY in limited mode (when Gemini is unavailable).
// Returns pseudo-tactics in the same shape as Gemini tactics, at most one per
// category, with exact_span copied from the message.

const { findEntity } = require('./entities');

// Each category: tactic type, explanation, and patterns (English, Hinglish,
// romanised Assamese, Assamese and Hindi script). Latin patterns use word
// boundaries; Indic script patterns are plain substrings.
const CATEGORIES = [
  {
    id: 'urgency',
    type: 'urgency',
    explanation: 'Pushes you to act quickly before you can check.',
    latin: [
      'immediately', 'urgent(?:ly)?', 'right now', 'act now', 'tonight', 'last chance',
      'within \\d+\\s*(?:hours?|hrs?|minutes?|mins?|days?)', '\\d+\\s*ghante', 'turant', 'jaldi',
      'aji rati', 'loge loge', 'lage lage', 'joruri', 'zoruri',
    ],
    script: ['तुरंत', 'जल्दी', 'লগে লগে', 'জৰুৰী', 'এতিয়াই', 'আজি নিশা'],
  },
  {
    id: 'threat',
    type: 'threat',
    explanation: 'Threatens a loss or penalty to scare you into acting.',
    latin: [
      'blocked', 'will be block', 'suspend(?:ed)?', 'disconnect(?:ed|ion)?', 'deactivat(?:ed|ion)',
      'band ho jayega', 'band ho jaayega', 'kati dia', 'legal action', 'illegal', 'penalty',
      'digital arrest', 'arrest(?:ed)?', 'warrant', 'will be returned',
    ],
    script: ['বিচ্ছিন্ন', 'বন্ধ কৰা হ', 'ডিজিটেল এৰেষ্ট', 'ब्लॉक', 'बंद हो', 'गिरफ्तार'],
  },
  {
    id: 'authority',
    type: 'authority',
    explanation: 'Claims to be an official or authority to gain trust.',
    latin: ['CBI', 'cyber cell', 'crime branch', 'police', 'officer', 'head office', 'customs', 'narcotics', 'court', 'RBI'],
    script: ['পুলিচ', 'অফিচাৰ', 'पुलिस', 'अधिकारी'],
  },
  {
    id: 'reward',
    type: 'reward',
    explanation: 'Promises money or a prize to lure you in.',
    latin: [
      'congratulations', 'you have won', 'has won', 'lucky draw', 'lottery', 'prize', 'cashback',
      'reward points?', 'earn rs', 'earn ₹', 'eligible for a refund', 'refund of',
    ],
    script: ['পুৰস্কাৰ', 'লটাৰী', 'इनाम', 'लॉटरी'],
  },
  {
    id: 'loan_bait',
    type: 'other',
    explanation: 'Offers an instant or pre-approved loan with no checks, a common opening for loan-app scams.',
    latin: [
      'instant loan', 'pre-?approved(?: loan)?', 'processing fee', 'no documents?(?: needed| required)?',
      'turant loan', 'bina document',
    ],
    script: ['তাৎক্ষণিক ঋণ', 'तुरंत लोन', 'इंस्टेंट लोन', 'प्री-अप्रूव्ड'],
  },
  {
    id: 'job_lure',
    type: 'other',
    explanation: 'Easy online job offer, a common opening for task scams.',
    latin: ['part[- ]time job', 'work from home', 'liking (?:youtube )?videos', 'no experience needed'],
    script: [],
  },
  {
    id: 'secrecy',
    type: 'secrecy',
    explanation: 'Asks you to keep this secret or stay isolated.',
    latin: ["don'?t tell", 'do not tell anyone', 'keep (?:this )?(?:secret|confidential)', 'stay on (?:the )?video call', 'kisi ko mat'],
    script: ['কাকো নক', 'किसी को मत'],
  },
  {
    id: 'emotional_family',
    type: 'emotional_family',
    explanation: 'Uses family or emotional pressure, often from a "new number".',
    latin: ['new number', 'naya number', 'notun number', 'phone (?:is )?(?:broken|broke|lost)'],
    script: ['নতুন নম্বৰ', 'ফোন ভাঙি', 'नया नंबर'],
  },
  {
    id: 'otp_request',
    type: 'other',
    explanation: 'Asks for an OTP, PIN or code. Genuine organisations never ask for these.',
    negatable: true,
    latin: [
      '(?:tell|share|send|give|forward)(?: me| us)? (?:the |your |this )?(?:otp|code|pin|cvv)',
      'enter (?:your )?(?:upi )?pin', 'otp (?:batao|bataiye|bhejo|do|dia)',
    ],
    script: ['OTP দিয়ক', 'OTP দিয়া', 'ওটিপি', 'OTP बताएं', 'OTP बताइए'],
  },
  {
    id: 'kyc',
    type: 'other',
    explanation: 'Uses a "KYC update" pretext, a very common bank and utility scam.',
    latin: ['re-?kyc', 'kyc', 'pan update', 'pan/kyc'],
    script: ['কেৱাইচি', 'केवाईसी'],
  },
  {
    id: 'payment_request',
    type: 'other',
    explanation: 'Asks you to send money or accept a payment request.',
    negatable: true,
    latin: [
      'processing fee', 'registration fee', 'transfer rs', 'transfer ₹', 'pay (?:a )?fee', 'send money',
      'paise bhej', 'accept the (?:collect )?request', 'to receive (?:the )?money',
    ],
    script: ['টকা পঠিয়াই', 'পইচা পঠিয়াই', 'पैसे भेज'],
  },
];

const NEGATION = /\b(?:not|never|don'?t|do not|mat|na|nohobo)\b[^.!?\n]{0,20}$/i;

function compile(cat) {
  const parts = [];
  if (cat.latin.length) parts.push(`(?<![\\p{L}\\p{N}])(?:${cat.latin.join('|')})(?![\\p{L}\\p{N}])`);
  if (cat.script.length) parts.push(cat.script.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  return new RegExp(parts.join('|'), 'giu');
}

const COMPILED = CATEGORIES.map((c) => ({ ...c, re: compile(c) }));

/** Detect pseudo-tactics in (masked) text. */
function detectTactics(text) {
  if (typeof text !== 'string' || !text) return [];
  const tactics = [];
  for (const cat of COMPILED) {
    cat.re.lastIndex = 0;
    let m;
    while ((m = cat.re.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (cat.negatable && NEGATION.test(before)) continue;
      tactics.push({ type: cat.type, exact_span: m[0], explanation: cat.explanation, source: 'heuristic', category: cat.id });
      break; // one per category
    }
  }
  return tactics;
}

// ---------------------------------------------------------------------------
// Requested actions (limited mode). Mirrors Gemini's requested_actions for the
// three asks that matter most when the AI is down. Kept deliberately narrow:
// share_otp and make_payment are "dangerous" in the scorer, so a loose match
// here would turn genuine bills and alerts into high_risk.
// ---------------------------------------------------------------------------

// A phone number in raw text, or the [PHONE] placeholder in masked text, or a wa.me link.
const PHONE = String.raw`(?:\[PHONE\]|(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|wa\.me\/\d+)`;

const CALL_VERBS = [
  // English
  String.raw`call(?: us| me| now| on| at)?`, 'contact(?: us| me| now| on| at)?', 'whats ?app(?: us| me| on| at)?', 'dial', 'ring',
  // Hinglish
  'call kar(?:o|ein|en|iye|na)', 'sampark kar(?:o|ein|en|iye)', 'baat kar(?:o|ein|en|iye)', 'phone kar(?:o|ein|en|iye)',
  // romanised Assamese
  'phone kor(?:ok|ib|a|iba)', 'call kor(?:ok|ib|a|iba)', 'jogajog kor(?:ok|ib|a|iba)', 'jugajug kor(?:ok|ib|a|iba)',
];
const CALL_SCRIPT = ['যোগাযোগ কৰক', 'যোগাযোগ কৰিব', 'ফোন কৰক', 'ফোন কৰিব', 'কল কৰক', 'कॉल करें', 'कॉल करो', 'संपर्क करें', 'फ़ोन करें', 'फोन करें'];

const CALL_VERB_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${CALL_VERBS.join('|')})(?![\\p{L}\\p{N}])|${CALL_SCRIPT.join('|')}`,
  'giu',
);
const PHONE_RE = new RegExp(PHONE, 'i');
const NEAR = 60; // characters between the verb and the number, either side

const OTP_REQUEST = new RegExp(
  [
    String.raw`(?<![\p{L}\p{N}])(?:tell|share|send|give|forward|provide|read out)(?: me| us)? (?:the |your |this |that )?(?:otp|one[- ]time password|pin|cvv|code)(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])enter (?:your |the )?(?:upi )?(?:pin|otp|mpin)(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])(?:otp|pin|code) (?:batao|bataiye|bata do|bhejo|bhejiye|do|dijiye|dia|diya|dibo|dibi|pothiai diya)(?![\p{L}\p{N}])`,
    'OTP দিয়ক', 'OTP দিব', 'ক’ড দিয়ক', "ক'ড দিয়ক", 'ওটিপি দিয়ক', 'OTP बताएं', 'OTP बताइए', 'OTP बताओ', 'OTP भेजें',
  ].join('|'),
  'giu',
);

const PAYMENT_REQUEST = new RegExp(
  [
    String.raw`(?<![\p{L}\p{N}])pay(?: a| the| your)? (?:rs\.?|₹|inr|\d|fee|fees|charges?|penalty|fine|amount|now|immediately|small)`,
    String.raw`(?<![\p{L}\p{N}])(?:transfer|send|deposit)(?: us| me)? (?:rs\.?|₹|inr|\d|money|the amount|amount|payment)`,
    String.raw`(?<![\p{L}\p{N}])(?:processing|registration|delivery|release|clearance|verification) (?:fee|charges?)`,
    String.raw`(?<![\p{L}\p{N}])(?:paise|paisa|rupaye|payment) (?:bhej(?:o|ein|en|iye|na)|kar(?:o|ein|en|iye)|transfer kar(?:o|ein|en|iye))`,
    String.raw`(?<![\p{L}\p{N}])(?:taka|poisa) (?:pothiai|pothiyai|pothaok|pothiyok|diok|dibo)`,
    String.raw`(?<![\p{L}\p{N}])(?:pay|send|transfer)[^.!?\n]{0,25}(?:via|through|on|using|by) (?:upi|gpay|google pay|phonepe|paytm)`,
    'টকা পঠিয়াওক', 'টকা পঠিয়াই দিয়ক', 'টকা পঠিয়াই দিয়া', 'টকা পঠিয়াই দিবা', 'পইচা পঠিয়াওক', 'পইচা পঠিয়াই দিয়ক', 'টকা জমা কৰক', 'পৈচা পঠিয়াওক',
    'पैसे भेजें', 'पैसे भेजो', 'भुगतान करें', 'पेमेंट करें', 'शुल्क जमा करें',
  ].join('|'),
  'giu',
);

function firstUnnegated(re, text) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (!NEGATION.test(before)) return m;
  }
  return null;
}

function asksToCall(text) {
  CALL_VERB_RE.lastIndex = 0;
  let m;
  while ((m = CALL_VERB_RE.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (NEGATION.test(before)) continue;
    const start = Math.max(0, m.index - NEAR);
    const window = text.slice(start, m.index + m[0].length + NEAR);
    if (PHONE_RE.test(window)) return true;
  }
  return false;
}

/**
 * What the message asks the reader to do, for limited mode only.
 * @returns {string[]} subset of ['share_otp', 'make_payment', 'call_number'], in that order
 */
function detectRequestedActions(text) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  if (firstUnnegated(OTP_REQUEST, text)) out.push('share_otp');
  if (firstUnnegated(PAYMENT_REQUEST, text)) out.push('make_payment');
  if (asksToCall(text)) out.push('call_number');
  return out;
}

/** Best-effort claimed sender for limited mode: first known entity named in the text. */
function guessClaimedSender(text) {
  const e = findEntity(text);
  return e ? e.name : null;
}

module.exports = { CATEGORIES, detectTactics, detectRequestedActions, guessClaimedSender };
