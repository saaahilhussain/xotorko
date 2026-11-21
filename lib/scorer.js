'use strict';

const { NEVER_SAY, containsForbidden } = require('./policy');

const VERDICTS = Object.freeze({
  HIGH_RISK: 'high_risk',
  UNABLE_TO_VERIFY: 'unable_to_verify',
  NO_STRONG_INDICATORS: 'no_strong_indicators',
});

// Requested actions that are high risk unless the sender is verified.
const DANGEROUS_ACTIONS = Object.freeze(['share_otp', 'enter_credentials', 'install_app', 'upi_collect_accept', 'make_payment']);
// Requested actions that are a weak signal on their own.
const WEAK_ACTIONS = Object.freeze(['click_link', 'call_number']);

const STRONG_LINK_SIGNALS = Object.freeze(['lookalike', 'bank_claim_not_bank_in', 'apk_download']);
const WEAK_LINK_SIGNALS = Object.freeze(['url_shortener', 'non_https', 'suspicious_tld', 'ip_address_host']);

const WEIGHT = Object.freeze({ strong: 3, medium: 2, weak: 1 });

const ACTION_LABELS = {
  share_otp: 'Asks you to share an OTP, PIN or code',
  enter_credentials: 'Asks for passwords, card or account details',
  install_app: 'Asks you to install an app',
  upi_collect_accept: 'Asks you to accept a UPI request or enter your UPI PIN',
  make_payment: 'Asks you to send money',
  click_link: 'Asks you to open a link',
  call_number: 'Asks you to call or message a number',
};

const SIGNAL_LABELS = {
  lookalike: 'Link imitates an official brand',
  bank_claim_not_bank_in: 'Claims to be a bank, but the link is not a .bank.in domain',
  apk_download: 'Link downloads an app file (.apk)',
  url_shortener: 'Link is shortened and hides its destination',
  non_https: 'Link is not https',
  suspicious_tld: 'Link uses a domain ending common in scams',
  ip_address_host: 'Link points to a raw IP address',
};

const TACTIC_LABELS = {
  urgency: 'Urgency',
  threat: 'Threat',
  authority: 'Claims authority',
  reward: 'Promise of reward',
  lookalike_link: 'Lookalike link',
  secrecy: 'Secrecy',
  emotional_family: 'Emotional / family pressure',
  other: 'Pressure tactic',
};

/**
 * Deterministic verdict.
 * @param {object} input
 * @param {Array} input.tactics            grounded tactics (Gemini or heuristic)
 * @param {string[]} input.requested_actions
 * @param {Array} input.urlResults         output of urlCheck.checkUrls
 * @param {boolean} input.senderVerified   true only if channel compare matched
 * @returns {{ verdict, contributors: {source, label, weight}[] }}
 */
function score({ tactics = [], requested_actions = [], urlResults = [], senderVerified = false } = {}) {
  const contributors = [];
  let strong = false;
  let weak = 0;

  // Behaviour: what the message asks you to do.
  for (const action of new Set(requested_actions)) {
    if (DANGEROUS_ACTIONS.includes(action) && !senderVerified) {
      strong = true;
      contributors.push({ source: 'behaviour', label: `${ACTION_LABELS[action]} (sender not verified)`, weight: WEIGHT.strong });
    } else if (WEAK_ACTIONS.includes(action) && !senderVerified) {
      weak += 1;
      contributors.push({ source: 'behaviour', label: ACTION_LABELS[action], weight: WEIGHT.weak });
    }
  }

  // Link signals, one contributor per signal type.
  const seenSignals = new Set();
  for (const r of urlResults) {
    for (const s of r.signals) {
      if (seenSignals.has(s.type)) continue;
      if (STRONG_LINK_SIGNALS.includes(s.type)) {
        strong = true;
        contributors.push({ source: 'link', label: `${SIGNAL_LABELS[s.type]}: ${r.host}`, weight: WEIGHT.strong });
      } else if (WEAK_LINK_SIGNALS.includes(s.type)) {
        weak += 1;
        contributors.push({ source: 'link', label: `${SIGNAL_LABELS[s.type]}: ${r.host}`, weight: WEIGHT.weak });
      } else {
        continue;
      }
      seenSignals.add(s.type);
    }
  }

  // Message tactics.
  const tacticWeight = tactics.length >= 2 ? WEIGHT.medium : WEIGHT.weak;
  for (const t of tactics) {
    contributors.push({ source: 'message', label: `${TACTIC_LABELS[t.type] || TACTIC_LABELS.other}: "${t.exact_span}"`, weight: tacticWeight });
  }
  if (tactics.length >= 2) strong = true;
  else weak += tactics.length;

  let verdict = VERDICTS.NO_STRONG_INDICATORS;
  if (strong) verdict = VERDICTS.HIGH_RISK;
  else if (weak > 0) verdict = VERDICTS.UNABLE_TO_VERIFY;

  contributors.sort((a, b) => b.weight - a.weight);
  return { verdict, contributors };
}

module.exports = {
  VERDICTS,
  NEVER_SAY,
  containsForbidden,
  DANGEROUS_ACTIONS,
  STRONG_LINK_SIGNALS,
  WEAK_LINK_SIGNALS,
  score,
};
