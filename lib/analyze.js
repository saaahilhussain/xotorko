'use strict';

const { sanitizeInput, mask, extractUrls } = require('./sanitize');
const { checkUrls } = require('./urlCheck');
const { findEntity } = require('./entities');
const { compareChannel } = require('./channelCompare');
const heuristics = require('./heuristics');
const { score, VERDICTS } = require('./scorer');
const gemini = require('../services/gemini');
const actionsData = require('../data/actions.json');

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
    this.status = 400;
  }
}

/**
 * Full pipeline: sanitize -> mask -> [Gemini || URL engine] -> scorer -> channel compare.
 * Nothing is stored. Throws InputError for invalid input.
 */
async function analyzeText(input) {
  const clean = sanitizeInput(input);
  if (!clean.ok) throw new InputError(clean.error);

  const masked = mask(clean.text);
  const urls = extractUrls(clean.text);

  // Gemini sees only masked text. The URL engine is deterministic and local.
  const ai = await gemini.analyzeMessage(masked);
  const limited_mode = ai === null;

  const tactics = limited_mode ? heuristics.detectTactics(masked) : ai.tactics;
  const requested_actions = limited_mode ? [] : ai.requested_actions.filter((a) => a !== 'none');
  const claimed = limited_mode ? heuristics.guessClaimedSender(masked) : ai.claimed_sender;

  const claimedEntity = findEntity(claimed);
  const urlResults = checkUrls(urls, claimedEntity);
  const channel_compare = compareChannel(claimed, urlResults);

  const { verdict, contributors } = score({
    tactics,
    requested_actions,
    urlResults,
    senderVerified: Boolean(channel_compare && channel_compare.match),
  });

  return {
    verdict,
    contributors,
    evidence: {
      message: tactics.map(({ type, exact_span, explanation, source }) => ({ type, exact_span, explanation, source })),
      link: urlResults,
      behaviour: requested_actions,
    },
    channel_compare,
    limited_mode,
    disclaimer: verdict === VERDICTS.NO_STRONG_INDICATORS ? actionsData.low_signal_disclaimer.en : null,
  };
}

module.exports = { analyzeText, InputError };
