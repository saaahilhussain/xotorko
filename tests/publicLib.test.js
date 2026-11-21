const L = require('../public/lib');
const I18N = require('../public/i18n');
const { NEVER_SAY } = require('../lib/policy');

const tEn = (k, v) => I18N.t('en', k, v);

const result = {
  verdict: 'high_risk',
  claimed_sender: 'SBI',
  evidence: {
    message: [
      { type: 'threat', exact_span: 'will be blocked today', explanation: 'Threatens a block.' },
      { type: 'urgency', exact_span: 'Update now', explanation: 'Rushes you.' },
    ],
    link: [{
      url: 'https://sbi-kyc-verify.top/login',
      host: 'sbi-kyc-verify.top',
      signals: [
        { type: 'suspicious_tld', reason: '...' },
        { type: 'lookalike', reason: '...' },
      ],
    }],
    behaviour: ['click_link', 'enter_credentials'],
  },
  channel_compare: { claimed: 'State Bank of India', link_domains: ['sbi-kyc-verify.top'], expected_domains: ['sbi.bank.in'], match: false },
  limited_mode: false,
};

describe('defang', () => {
  test('neutralises scheme and every dot', () => {
    expect(L.defang('https://sbi-kyc-verify.top/login')).toBe('hxxps://sbi-kyc-verify[.]top/login');
    expect(L.defang('http://bill-update-apdcl.site/APDCL_Update.apk')).toBe('hxxp://bill-update-apdcl[.]site/APDCL_Update[.]apk');
    expect(L.defang('bit.ly/abc')).toBe('bit[.]ly/abc');
    expect(L.defang('HTTPS://X.IO')).toBe('hxxpS://X[.]IO');
    expect(L.defang(undefined)).toBe('');
  });

  test('output no longer contains a clickable URL pattern', () => {
    const out = L.defang('https://a.b.example.com/x');
    expect(out).not.toMatch(/https?:\/\//i);
    expect(out).not.toMatch(/\w\.\w/);
  });
});

describe('highlightSegments', () => {
  const text = 'Your account will be blocked today. Update now: https://x.top';

  test('marks spans and round-trips the text exactly', () => {
    const segs = L.highlightSegments(text, result.evidence.message);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.tactic).map((s) => [s.tactic.type, s.text])).toEqual([
      ['threat', 'will be blocked today'],
      ['urgency', 'Update now'],
    ]);
  });

  test('matches masked placeholders against the original text', () => {
    const segs = L.highlightSegments('Call officer 9000000011 now', [{ type: 'urgency', exact_span: 'Call officer [PHONE] now' }]);
    expect(segs).toEqual([{ text: 'Call officer 9000000011 now', tactic: { type: 'urgency' } }]);
  });

  test('drops overlapping and missing spans', () => {
    const segs = L.highlightSegments('abc def', [
      { type: 'threat', exact_span: 'abc def' },
      { type: 'urgency', exact_span: 'def' },
      { type: 'reward', exact_span: 'zzz' },
    ]);
    expect(segs.filter((s) => s.tactic)).toHaveLength(1);
  });
});

describe('buildReport', () => {
  const now = new Date(2026, 10, 21, 14, 5);
  const report = L.buildReport(result, { t: tEn, now, state: 'paid' });

  test('includes claimed sender, tactics, defanged links, verdict and time', () => {
    expect(report).toContain('Claimed sender: State Bank of India');
    expect(report).toContain('Verdict: High risk');
    expect(report).toContain('Time checked: 2026-11-21 14:05');
    expect(report).toContain('THREAT: "will be blocked today"');
    expect(report).toContain(['- hxxps://sbi-kyc-verify[.]top/login', '  - the link copies an official name', '  - the link uses a web address ending'].join('\n'));
    expect(report).toContain('- Open a link.');
    expect(report).toContain('What I have already done: Paid money');
    expect(report).toContain('Official domain(s) of State Bank of India: sbi.bank.in');
  });

  test('never contains a live link to the scam site', () => {
    expect(report).not.toContain('https://sbi-kyc-verify.top');
  });

  test('handles empty evidence and limited mode', () => {
    const r = L.buildReport({ verdict: 'unable_to_verify', evidence: { message: [], link: [], behaviour: [] }, limited_mode: true }, { t: tEn, now });
    expect(r).toContain('Claimed sender: Not stated');
    expect(r).toContain("Verdict: Couldn't verify");
    expect(r).toContain('- None found');
    expect(r).toContain('rule-based check only');
  });
});

describe('buildWarning / whatsappUrl', () => {
  test.each(I18N.LANGS)('%s: sender, two reasons, defanged link, no live URL', (lang) => {
    const t = (k, v) => I18N.t(lang, k, v);
    const msg = L.buildWarning(result, { t });
    expect(msg).toContain('State Bank of India');
    expect(msg).toContain(t('why_lookalike'));
    expect(msg).toContain(t('why_suspicious_tld'));
    expect(msg).toContain('hxxps://sbi-kyc-verify[.]top/login');
    expect(msg).not.toMatch(/https?:\/\//);
    const url = L.whatsappUrl(msg);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(msg);
  });

  test('topReasons puts link warnings before tactics', () => {
    expect(L.topReasons(result, 3)).toEqual(['lookalike', 'suspicious_tld', 'threat']);
  });
});

describe('i18n', () => {
  test('every language has every English key', () => {
    const keys = Object.keys(I18N.STRINGS.en);
    for (const lang of I18N.LANGS) {
      const missing = keys.filter((k) => !(k in I18N.STRINGS[lang]));
      expect({ lang, missing }).toEqual({ lang, missing: [] });
    }
  });

  test('falls back to English for unknown languages and keys', () => {
    expect(I18N.t('fr', 'check_btn')).toBe('Check message');
    expect(I18N.t('as', 'no_such_key')).toBe('no_such_key');
  });

  test('no UI string says "safe" (or the Hindi/Assamese equivalent)', () => {
    const forbidden = [...NEVER_SAY, 'सुरक्षित', 'সুৰক্ষিত', 'নিৰাপদ'];
    for (const lang of I18N.LANGS) {
      const text = JSON.stringify(I18N.STRINGS[lang]).toLowerCase();
      forbidden.forEach((w) => expect(`${lang}:${text.includes(w)}:${w}`).toBe(`${lang}:false:${w}`));
    }
  });

  test('Assamese UI strings use ৰ (U+09F0), never Bengali র (U+09B0)', () => {
    const bad = Object.entries(I18N.STRINGS.as).filter(([, v]) => v.includes('র')).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  test('examples match the eval fixtures', () => {
    const fixtures = require('./fixtures/eval.json');
    const items = Array.isArray(fixtures) ? fixtures : fixtures.items;
    for (const id of ['s02', 's04', 's13']) expect(items.find((i) => i.id === id).text).toBe(L.EXAMPLES[id]);
  });

  test('every example chip in index.html has text and a label in all languages', () => {
    const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const ids = [...html.matchAll(/data-example="(\w+)" data-i18n="(\w+)"/g)];
    expect(ids.map((m) => m[1])).toEqual(['s02', 's04', 's13', 'loan']);
    for (const [, id, key] of ids) {
      expect(typeof L.EXAMPLES[id]).toBe('string');
      for (const lang of I18N.LANGS) expect(I18N.STRINGS[lang][key]).toBeTruthy();
    }
  });
});

describe('groupLinksByDomain', () => {
  test('one group per host, warnings ordered by severity, duplicates removed', () => {
    const groups = L.groupLinksByDomain([
      { url: 'https://sbi-kyc.top/a', host: 'sbi-kyc.top', signals: [{ type: 'suspicious_tld', reason: 'tld' }, { type: 'lookalike', reason: 'look' }] },
      { url: 'https://SBI-KYC.top/b', host: 'SBI-KYC.top', signals: [{ type: 'lookalike', reason: 'look' }] },
      { url: 'https://sbi.bank.in', host: 'sbi.bank.in', signals: [{ type: 'official_match', reason: 'official' }] },
      { url: 'https://example.org', host: 'example.org', signals: [] },
    ]);
    expect(groups.map((g) => g.host)).toEqual(['sbi-kyc.top', 'sbi.bank.in', 'example.org']);
    expect(groups[0].urls).toHaveLength(2);
    expect(groups[0].signals.map((s) => s.type)).toEqual(['lookalike', 'suspicious_tld']);
    expect(groups[1].signals.map((s) => s.type)).toEqual(['official_match']);
    expect(groups[2].signals).toEqual([]);
  });

  test('tolerates bad input', () => {
    expect(L.groupLinksByDomain(undefined)).toEqual([]);
    expect(L.groupLinksByDomain([null, {}])).toEqual([]);
  });
});
