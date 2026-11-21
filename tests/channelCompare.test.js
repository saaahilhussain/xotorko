const { compareChannel } = require('../lib/channelCompare');
const { checkUrls } = require('../lib/urlCheck');

describe('channelCompare', () => {
  test('SBI claim with a lookalike link is a mismatch', () => {
    const r = compareChannel('SBI', checkUrls(['https://sbi-kyc-verify.top/login']));
    expect(r.entity.id).toBe('sbi');
    expect(r.match).toBe(false);
    expect(r.link_domains).toEqual(['sbi-kyc-verify.top']);
    expect(r.expected_domains).toEqual(expect.arrayContaining(['sbi.bank.in']));
  });

  test('APDCL claim with apdcl.org matches and carries the DAPDCL note', () => {
    const r = compareChannel('apdcl', checkUrls(['apdcl.org']));
    expect(r.entity.id).toBe('apdcl');
    expect(r.match).toBe(true);
    expect(r.official_sms_sender_id).toBe('DAPDCL');
    expect(r.note).toMatch(/DAPDCL/);
  });

  test('matches aliases case-insensitively and inside longer claims', () => {
    expect(compareChannel('state bank of india', []).entity.id).toBe('sbi');
    expect(compareChannel('SBI head office', []).entity.id).toBe('sbi');
  });

  test('no links means no match; unknown sender returns null', () => {
    expect(compareChannel('SBI', []).match).toBe(false);
    expect(compareChannel('my cousin', [])).toBeNull();
    expect(compareChannel(null, [])).toBeNull();
  });
});
