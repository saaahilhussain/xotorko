const { sanitizeInput, mask, extractUrls, MAX_LENGTH } = require('../lib/sanitize');

describe('sanitizeInput', () => {
  test('trims whitespace', () => {
    expect(sanitizeInput('   hello  \n')).toEqual({ ok: true, text: 'hello' });
  });

  test('rejects empty and whitespace-only input', () => {
    expect(sanitizeInput('').ok).toBe(false);
    expect(sanitizeInput('   \n\t ').ok).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(sanitizeInput(undefined).ok).toBe(false);
    expect(sanitizeInput({ text: 'x' }).ok).toBe(false);
  });

  test('enforces the max length', () => {
    expect(sanitizeInput('a'.repeat(MAX_LENGTH)).ok).toBe(true);
    const r = sanitizeInput('a'.repeat(MAX_LENGTH + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too long/);
  });
});

describe('mask', () => {
  test('masks 10-digit phone numbers, with or without +91', () => {
    expect(mask('call 9000000011 now')).toBe('call [PHONE] now');
    expect(mask('call +91 90000 00011 now')).toBe('call [PHONE] now');
  });

  test('masks OTP-like codes but keeps amounts', () => {
    expect(mask('482913 is your OTP. Rs 4999 fee')).toBe('[CODE] is your OTP. Rs 4999 fee');
    expect(mask('otp 1234.')).toBe('otp [CODE].');
  });

  test('masks account and card numbers', () => {
    expect(mask('A/c 123456789012 credited')).toBe('A/c [ACCOUNT] credited');
    expect(mask('card 4111 1111 1111 1111 ok')).toBe('card [ACCOUNT] ok');
  });

  test('masks email addresses', () => {
    expect(mask('write to help.desk@gmail.com')).toBe('write to [EMAIL]');
  });

  test('keeps URLs intact, even when they contain digits', () => {
    const t = 'Contact wa.me/919000000014 or http://x.top/9876543210 or 9876543210';
    expect(mask(t)).toBe('Contact wa.me/919000000014 or http://x.top/9876543210 or [PHONE]');
  });
});

describe('extractUrls', () => {
  test('finds http(s) URLs and strips trailing punctuation', () => {
    expect(extractUrls('Go to https://sbi-kyc-verify.top/login. Now!')).toEqual([
      'https://sbi-kyc-verify.top/login',
    ]);
  });

  test('finds bare domains, shorteners and wa.me links', () => {
    expect(extractUrls('visit sbi-kyc.xyz/path or bit.ly/abc or wa.me/919000000014')).toEqual([
      'sbi-kyc.xyz/path',
      'bit.ly/abc',
      'wa.me/919000000014',
    ]);
  });

  test('does not treat emails, UPI IDs or amounts as URLs', () => {
    expect(extractUrls('pay grocer@okaxis or mail a@b.com, Rs.1,250.00')).toEqual([]);
  });

  test('de-duplicates repeated links', () => {
    expect(extractUrls('apdcl.org and APDCL.org')).toEqual(['apdcl.org']);
  });
});
