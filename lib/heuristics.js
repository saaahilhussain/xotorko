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

/** Best-effort claimed sender for limited mode: first known entity named in the text. */
function guessClaimedSender(text) {
  const e = findEntity(text);
  return e ? e.name : null;
}

module.exports = { CATEGORIES, detectTactics, guessClaimedSender };
