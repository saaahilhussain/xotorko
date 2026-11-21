'use strict';

const {
  SHORTENERS,
  SUSPICIOUS_TLDS,
  RESERVED_SUFFIXES,
  BRAND_TOKENS,
  officialEntityForHost,
  isOfficialFor,
} = require('./entities');

const SIGNALS = Object.freeze([
  'url_shortener',
  'apk_download',
  'non_https',
  'suspicious_tld',
  'ip_address_host',
  'lookalike',
  'bank_claim_not_bank_in',
  'official_match',
]);

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function parse(raw) {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  try {
    const u = new URL(hasScheme ? raw : `http://${raw}`);
    return {
      scheme: hasScheme ? u.protocol.replace(':', '') : null,
      host: u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''),
      path: decodeURIComponentSafe(u.pathname + u.search),
    };
  } catch {
    return null;
  }
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function entityRef(e) {
  return e ? { id: e.id, name: e.name, type: e.type } : null;
}

/**
 * Deterministically check one URL.
 * @param {string} raw URL as written in the message
 * @param {object|null} claimedEntity entity from data/genuine.json the sender claims to be
 * @returns {{ url, host, signals: {type, reason}[], entity }}
 */
function checkUrl(raw, claimedEntity = null) {
  const parsed = parse(raw);
  if (!parsed || !parsed.host) {
    return { url: raw, host: null, signals: [], entity: null };
  }
  const { scheme, host, path } = parsed;
  const signals = [];
  const add = (type, reason) => signals.push({ type, reason });

  const official = officialEntityForHost(host);
  const isIp = IPV4.test(host) || host.startsWith('[');

  if (SHORTENERS.has(host)) {
    add('url_shortener', `${host} is a link shortener: the real destination is hidden.`);
  }
  if (/\.apk(?:$|[?#&/])/i.test(path)) {
    add('apk_download', 'The link downloads an Android app (.apk) from outside the Play Store.');
  }
  if (scheme === 'http') {
    add('non_https', 'The link uses plain http, not https.');
  }
  const tld = SUSPICIOUS_TLDS.find((t) => host.endsWith(t));
  if (tld) {
    add('suspicious_tld', `The domain ends in ${tld}, a cheap ending often used in scam links.`);
  }
  if (isIp) {
    add('ip_address_host', 'The link points to a raw IP address instead of a named website.');
  }

  let entity = official;
  if (official) {
    add('official_match', `${host} is an official domain of ${official.name}.`);
  } else if (!isIp && !RESERVED_SUFFIXES.some((s) => host.endsWith(s))) {
    // Brand name as a whole token of a domain that is not that brand's official
    // domain. Tokens: hostname minus the TLD, split on ".", "-" and digits.
    const labels = host.split('.');
    const hostTokens = new Set(labels.slice(0, -1).join('.').split(/[.\-0-9]+/).filter(Boolean));
    const hit = BRAND_TOKENS.find(({ tokens }) => tokens.some((t) => hostTokens.has(t)));
    if (hit) {
      entity = hit.entity;
      const expected = hit.entity.official_domains.join(', ');
      add('lookalike', `${host} uses the name of ${hit.entity.name} but is not its official domain (${expected}).`);
    }
  }

  if (
    claimedEntity &&
    claimedEntity.type === 'bank' &&
    !host.endsWith('.bank.in') &&
    !isOfficialFor(claimedEntity, host) &&
    !official
  ) {
    add(
      'bank_claim_not_bank_in',
      `The message claims to be from ${claimedEntity.name}, but ${host} is not a .bank.in domain. Indian banks use .bank.in.`,
    );
  }

  return { url: raw, host, signals, entity: entityRef(entity) };
}

function checkUrls(urls, claimedEntity = null) {
  return (urls || []).map((u) => checkUrl(u, claimedEntity));
}

module.exports = { SIGNALS, checkUrl, checkUrls };
