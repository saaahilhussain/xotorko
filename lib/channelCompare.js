'use strict';

const { findEntity, isOfficialFor } = require('./entities');

/**
 * Compare the claimed sender with the official channels in data/genuine.json.
 * @param {string|null} claimed  claimed_sender as written in the message
 * @param {Array} urlResults     output of urlCheck.checkUrls
 * @returns {null | { claimed, entity, link_domains, expected_domains, match, note, official_sms_sender_id }}
 *   match is true only when the message has links and every one is an official domain of that entity.
 */
function compareChannel(claimed, urlResults = []) {
  const entity = findEntity(claimed);
  if (!entity) return null;
  const link_domains = [...new Set(urlResults.map((r) => r.host).filter(Boolean))];
  const match = link_domains.length > 0 && link_domains.every((h) => isOfficialFor(entity, h));
  return {
    claimed,
    entity: { id: entity.id, name: entity.name, type: entity.type },
    link_domains,
    expected_domains: [...entity.official_domains],
    match,
    note: entity.helpline_note || null,
    official_sms_sender_id: entity.official_sms_sender_id || null,
  };
}

module.exports = { compareChannel };
