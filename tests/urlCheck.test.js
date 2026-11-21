const { checkUrl } = require('../lib/urlCheck');
const { findEntity } = require('../lib/entities');

const types = (r) => r.signals.map((s) => s.type);
const sbi = findEntity('SBI');

describe('urlCheck', () => {
  test('flags URL shorteners', () => {
    expect(types(checkUrl('bit.ly/hdfc-kyc-now'))).toContain('url_shortener');
  });

  test('flags APK downloads', () => {
    expect(types(checkUrl('http://bill-update-apdcl.site/APDCL_Update.apk'))).toContain('apk_download');
  });

  test('flags plain http but not bare domains', () => {
    expect(types(checkUrl('http://example.com/x'))).toContain('non_https');
    expect(types(checkUrl('example.com/x'))).not.toContain('non_https');
  });

  test('flags raw IP hosts', () => {
    expect(types(checkUrl('http://192.168.10.5/login'))).toContain('ip_address_host');
  });

  test('sbi-kyc-verify.top is a lookalike on a suspicious TLD', () => {
    const r = checkUrl('https://sbi-kyc-verify.top/login');
    expect(types(r)).toEqual(expect.arrayContaining(['lookalike', 'suspicious_tld']));
    expect(types(r)).not.toContain('official_match');
    expect(r.entity.id).toBe('sbi');
    r.signals.forEach((s) => expect(s.reason).toEqual(expect.any(String)));
  });

  test('flags bank claim with a non-.bank.in domain', () => {
    expect(types(checkUrl('bit.ly/abc', sbi))).toContain('bank_claim_not_bank_in');
    expect(types(checkUrl('https://sbi-help.com', sbi))).toContain('bank_claim_not_bank_in');
  });

  test('sbi.bank.in is an official SBI match with no risk signals', () => {
    const r = checkUrl('https://sbi.bank.in/login', sbi);
    expect(types(r)).toEqual(['official_match']);
    expect(r.entity.id).toBe('sbi');
  });

  test('apdcl.org is an official APDCL match', () => {
    const r = checkUrl('apdcl.org');
    expect(types(r)).toEqual(['official_match']);
    expect(r.entity.id).toBe('apdcl');
  });

  test('other lookalikes: apdcl and indiapost brands on unofficial domains', () => {
    expect(types(checkUrl('http://apdcl-kyc-update.xyz/pay'))).toContain('lookalike');
    expect(types(checkUrl('https://indiapost-redelivery.live/track'))).toContain('lookalike');
  });

  test('unrelated domain gets no lookalike signal', () => {
    expect(types(checkUrl('https://www.wikipedia.org/'))).toEqual([]);
  });
});
