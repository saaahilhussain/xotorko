'use strict';

// Pure helpers shared by the browser (window.XotorkoLib) and Jest (require).
// No DOM access here.
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.XotorkoLib = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  // Demo examples (from tests/fixtures/eval.json).
  const EXAMPLES = {
    s02: "প্ৰিয় গ্ৰাহক, আপোনাৰ বিদ্যুৎ সংযোগ আজি নিশা ৯:৩০ বজাত বিচ্ছিন্ন কৰা হ'ব। বিল আপডেট নাই। লগে লগে এই নম্বৰত যোগাযোগ কৰক 9000000012",
    s04: 'Dear SBI Customer, your YONO account will be blocked today due to pending PAN/KYC. Update now: https://sbi-kyc-verify.top/login',
    s13: 'Hi, I am sending you Rs 5000 for the OLX item. Please accept the request on your UPI app and enter your PIN to receive the money.',
  };

  const STATES = ['nothing', 'clicked', 'shared_otp', 'paid', 'installed_app'];

  // Link signals that count as warnings (official_match is informational).
  const LINK_WARNINGS = ['lookalike', 'bank_claim_not_bank_in', 'apk_download', 'suspicious_tld', 'url_shortener', 'ip_address_host', 'non_https'];

  /**
   * Make a URL or domain unclickable: http -> hxxp, every "." -> "[.]".
   * "https://sbi-kyc.top/a.apk" -> "hxxps://sbi-kyc[.]top/a[.]apk"
   */
  function defang(url) {
    if (typeof url !== 'string') return '';
    return url.replace(/^(\s*)h(t)tp/i, (m, sp) => `${sp}hxxp`).replace(/\./g, '[.]');
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Regex that finds a tactic span in the ORIGINAL (unmasked) text. Spans come
   * from masked text, so placeholders like [PHONE] match any run of characters.
   */
  function spanPattern(span) {
    const parts = span.split(/\[(?:PHONE|CODE|ACCOUNT|EMAIL)\]/);
    return new RegExp(parts.map(escapeRegExp).join('[^\\n]+?'), 'u');
  }

  /**
   * Split text into segments, marking where tactic spans occur.
   * @returns {{ text: string, tactic?: { type: string } }[]} in order; joining
   *          the text fields gives back the input exactly.
   */
  function highlightSegments(text, tactics) {
    if (typeof text !== 'string') return [];
    const ranges = [];
    for (const t of Array.isArray(tactics) ? tactics : []) {
      if (!t || typeof t.exact_span !== 'string' || !t.exact_span.trim()) continue;
      const m = spanPattern(t.exact_span.trim()).exec(text);
      if (m && m[0].length) ranges.push({ start: m.index, end: m.index + m[0].length, type: t.type });
    }
    // Earliest first; for equal starts, the longer span wins. Overlaps are dropped.
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    let pos = 0;
    for (const r of ranges) {
      if (r.start < pos) continue;
      if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
      out.push({ text: text.slice(r.start, r.end), tactic: { type: r.type } });
      pos = r.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos) });
    return out;
  }

  /** Unique URLs from the link evidence. */
  function linksOf(result) {
    const links = (result && result.evidence && Array.isArray(result.evidence.link)) ? result.evidence.link : [];
    return [...new Set(links.map((l) => l && l.url).filter(Boolean))];
  }

  /**
   * Top reason keys (for i18n "why_<key>"), link warnings first since they
   * carry the most weight in the scorer, then message tactics. Unique.
   */
  function topReasons(result, n = 2) {
    const keys = [];
    const ev = (result && result.evidence) || {};
    for (const l of ev.link || []) {
      for (const s of (l && l.signals) || []) {
        if (LINK_WARNINGS.includes(s.type)) keys.push(s.type);
      }
    }
    keys.sort((a, b) => LINK_WARNINGS.indexOf(a) - LINK_WARNINGS.indexOf(b));
    for (const tac of ev.message || []) if (tac && tac.type) keys.push(tac.type);
    return [...new Set(keys)].slice(0, n);
  }

  function claimedOf(result) {
    if (!result) return null;
    if (result.channel_compare && result.channel_compare.claimed) return result.channel_compare.claimed;
    return result.claimed_sender || null;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** Local time with UTC offset, e.g. "2026-11-21 14:05 (UTC+05:30)". */
  function formatTime(date) {
    const off = -date.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)})`;
  }

  /**
   * Plain-text incident report for a bank, 1930 or cybercrime.gov.in.
   * @param result /api/analyze response
   * @param opts.t        (key, vars) => string, labels for verdicts/tactics/states
   * @param opts.now      Date of the check
   * @param opts.state    what the user has already done (one of STATES), optional
   */
  function buildReport(result, { t, now = new Date(), state = null } = {}) {
    const ev = (result && result.evidence) || {};
    const lines = ['Xotorko incident report', `Time checked: ${formatTime(now)}`];
    lines.push(`Claimed sender: ${claimedOf(result) || 'Not stated'}`);
    lines.push(`Verdict: ${result && result.verdict ? t(`verdict_${result.verdict}`) : 'Unknown'}`);
    if (state && STATES.includes(state)) lines.push(`What I have already done: ${t(`state_${state}`)}`);

    const tactics = ev.message || [];
    lines.push('', 'Tactics found:');
    if (tactics.length === 0) lines.push('- None found');
    for (const tac of tactics) lines.push(`- ${t(`tac_${tac.type}`)}: "${tac.exact_span}"`);

    const links = ev.link || [];
    lines.push('', 'Links (defanged, do not open):');
    if (links.length === 0) lines.push('- None');
    for (const l of links) {
      const warnings = (l.signals || []).map((s) => s.type).filter((x) => LINK_WARNINGS.includes(x))
        .sort((a, b) => LINK_WARNINGS.indexOf(a) - LINK_WARNINGS.indexOf(b));
      lines.push(`- ${defang(l.url)}`);
      for (const w of warnings) lines.push(`  - ${t(`why_${w}`)}`);
    }

    const cc = result && result.channel_compare;
    if (cc && cc.expected_domains && cc.expected_domains.length) {
      lines.push('', `Official domain(s) of ${cc.claimed}: ${cc.expected_domains.join(', ')}`);
    }
    if (ev.behaviour && ev.behaviour.length) {
      lines.push('', 'The message asked me to:');
      for (const a of ev.behaviour) lines.push(`- ${t(`act_${a}`)}`);
    }
    if (result && result.limited_mode) lines.push('', 'Note: AI analysis was unavailable; rule-based check only.');
    return lines.join('\n');
  }

  /**
   * Short WhatsApp warning in the UI language. Links are defanged, never clickable.
   * @param opts.t (key, vars) => string in the current language
   */
  function buildWarning(result, { t } = {}) {
    const reasons = topReasons(result, 2).map((k) => t(`why_${k}`));
    const links = linksOf(result);
    return t('warn_text', {
      sender: claimedOf(result) || t('warn_someone'),
      reasons: reasons.length ? reasons.join('; ') : t('why_other'),
      link: links.length ? t('warn_link', { link: defang(links[0]) }) : '',
    });
  }

  function whatsappUrl(text) {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return {
    EXAMPLES,
    STATES,
    LINK_WARNINGS,
    defang,
    highlightSegments,
    linksOf,
    topReasons,
    claimedOf,
    formatTime,
    buildReport,
    buildWarning,
    whatsappUrl,
  };
});
