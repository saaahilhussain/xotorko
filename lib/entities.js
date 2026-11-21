'use strict';

// Read-only access to data/genuine.json. Code-owned; never written at runtime.
const genuine = require('../data/genuine.json');

const ENTITIES = genuine.entities;
const SHORTENERS = new Set(genuine.url_shorteners.map((s) => s.toLowerCase()));
const SUSPICIOUS_TLDS = genuine.suspicious_tlds.map((s) => s.toLowerCase());
const RESERVED_SUFFIXES = Object.keys(genuine._meta.reserved_suffixes).map((s) => s.toLowerCase());

// Short brand tokens that are distinctive enough to match even at 3 letters.
const SHORT_BRANDS = new Set(['sbi', 'pnb']);
// Alias words too generic to count as a brand inside a domain name.
const GENERIC_ALIASES = new Set(['police', 'railway', 'postoffice', 'state', 'statebank']);

function compact(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isAscii(s) {
  // eslint-disable-next-line no-control-regex -- intentional full ASCII range check
  return /^[\x00-\x7F]*$/.test(s);
}

/** Brand tokens per entity, used for lookalike detection in domains. */
const BRAND_TOKENS = ENTITIES.map((e) => {
  const tokens = new Set();
  const consider = (raw) => {
    if (!isAscii(raw)) return;
    const t = compact(raw);
    if (!/[a-z]/.test(t) || GENERIC_ALIASES.has(t)) return;
    if (t.length >= 4 || SHORT_BRANDS.has(t)) tokens.add(t);
  };
  consider(e.id);
  e.aliases.forEach(consider);
  e.official_domains.forEach((d) => consider(d.split('.')[0]));
  return { entity: e, tokens: [...tokens] };
});

function hostMatchesDomain(host, domain) {
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

/** Entity whose official_domains include this host (or a parent of it). */
function officialEntityForHost(host) {
  return ENTITIES.find((e) => e.official_domains.some((d) => hostMatchesDomain(host, d))) || null;
}

function isOfficialFor(entity, host) {
  return entity.official_domains.some((d) => hostMatchesDomain(host, d));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the entity a free-text sender claim refers to (case-insensitive, by
 * id, name, alias or official SMS sender ID). Longest matching alias wins.
 */
function findEntity(claimed) {
  if (typeof claimed !== 'string' || claimed.trim() === '') return null;
  const c = claimed.trim().toLowerCase();
  let best = null;
  for (const e of ENTITIES) {
    const names = [e.id, e.name, ...e.aliases];
    if (e.official_sms_sender_id) names.push(e.official_sms_sender_id);
    for (const n of names) {
      const name = n.toLowerCase();
      if (name.length < 2) continue;
      let hit;
      if (c === name) hit = true;
      else if (isAscii(name)) hit = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}([^a-z0-9]|$)`).test(c);
      else hit = c.includes(name);
      if (hit && (!best || name.length > best.len)) best = { entity: e, len: name.length };
    }
  }
  return best ? best.entity : null;
}

module.exports = {
  ENTITIES,
  SHORTENERS,
  SUSPICIOUS_TLDS,
  RESERVED_SUFFIXES,
  BRAND_TOKENS,
  compact,
  hostMatchesDomain,
  officialEntityForHost,
  isOfficialFor,
  findEntity,
};
