'use strict';

const actions = require('../data/actions.json');

// Words Xotorko must never say about a message. "safe" is always included,
// whatever data/actions.json lists.
const NEVER_SAY = Object.freeze([...new Set(['safe', ...actions.never_say.map((w) => w.toLowerCase())])]);

function containsForbidden(text) {
  if (typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return NEVER_SAY.some((w) => t.includes(w));
}

module.exports = { NEVER_SAY, containsForbidden };
