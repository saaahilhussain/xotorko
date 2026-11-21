'use strict';

// Vetted action cards from data/actions.json. Code-owned: Gemini never writes
// advice or phone numbers.
const data = require('../data/actions.json');

const STATES = Object.freeze(Object.keys(data.states)); // nothing, clicked, shared_otp, paid, installed_app
const LANGS = Object.freeze(['en', 'hi', 'as']);
const FALLBACK_LANG = 'en';

function pick(translations, lang) {
  if (!translations) return null;
  return translations[lang] || translations[FALLBACK_LANG] || null;
}

function resolveChannel(id) {
  const c = data._meta.channels[id];
  if (!c) return null;
  const out = { id, label: c.label, use_for: c.use_for };
  if (c.tel) out.tel = c.tel;
  if (c.url) out.url = c.url;
  if (c.how) out.how = c.how;
  return out;
}

/**
 * @param {string} state one of STATES
 * @param {string} [lang='en'] one of LANGS; missing translations fall back to English
 * @returns action card, or null for an unknown state or language
 */
function getActionCard(state, lang = FALLBACK_LANG) {
  if (!Object.prototype.hasOwnProperty.call(data.states, state) || !LANGS.includes(lang)) return null;
  const s = data.states[state];
  return {
    state,
    lang,
    urgency: s.urgency,
    label: pick(s.label, lang),
    headline: pick(s.headline, lang),
    steps: s.steps.map((step) => {
      const out = { text: pick(step, lang) };
      if (step.channel) out.channel = resolveChannel(step.channel);
      if (step.action) out.action = step.action;
      return out;
    }),
  };
}

module.exports = { STATES, LANGS, getActionCard };
