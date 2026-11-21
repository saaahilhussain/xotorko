const { score, VERDICTS, NEVER_SAY } = require('../lib/scorer');
const { checkUrls } = require('../lib/urlCheck');
const { findEntity } = require('../lib/entities');

const tactic = (type, exact_span = 'x') => ({ type, exact_span, explanation: 'e' });

describe('scorer', () => {
  test('dangerous action from an unknown sender is high_risk', () => {
    for (const a of ['share_otp', 'enter_credentials', 'install_app', 'upi_collect_accept', 'make_payment']) {
      expect(score({ requested_actions: [a] }).verdict).toBe(VERDICTS.HIGH_RISK);
    }
  });

  test('dangerous action from a verified sender is not high_risk on its own', () => {
    expect(score({ requested_actions: ['make_payment'], senderVerified: true }).verdict).toBe(
      VERDICTS.NO_STRONG_INDICATORS,
    );
  });

  test('lookalike, bank_claim_not_bank_in and apk links are high_risk', () => {
    expect(score({ urlResults: checkUrls(['https://sbi-kyc-verify.top/login']) }).verdict).toBe(VERDICTS.HIGH_RISK);
    expect(score({ urlResults: checkUrls(['bit.ly/x'], findEntity('HDFC')) }).verdict).toBe(VERDICTS.HIGH_RISK);
    expect(score({ urlResults: checkUrls(['https://files.example.com/app.apk']) }).verdict).toBe(VERDICTS.HIGH_RISK);
  });

  test('two or more tactics are high_risk', () => {
    expect(score({ tactics: [tactic('urgency'), tactic('threat')] }).verdict).toBe(VERDICTS.HIGH_RISK);
  });

  test('one weak signal is unable_to_verify', () => {
    expect(score({ tactics: [tactic('urgency')] }).verdict).toBe(VERDICTS.UNABLE_TO_VERIFY);
    expect(score({ urlResults: checkUrls(['bit.ly/x']) }).verdict).toBe(VERDICTS.UNABLE_TO_VERIFY);
  });

  test('nothing is no_strong_indicators', () => {
    const r = score({ urlResults: checkUrls(['apdcl.org']) });
    expect(r.verdict).toBe(VERDICTS.NO_STRONG_INDICATORS);
    expect(r.contributors).toEqual([]);
  });

  test('contributors carry source, label and weight', () => {
    const r = score({ tactics: [tactic('urgency', 'now')], requested_actions: ['share_otp'] });
    expect(r.contributors.map((c) => c.source)).toEqual(['behaviour', 'message']);
    r.contributors.forEach((c) => expect(c).toEqual({ source: expect.any(String), label: expect.any(String), weight: expect.any(Number) }));
  });

  test('never says "safe": no verdict or label contains it', () => {
    expect(NEVER_SAY).toContain('safe');
    Object.values(VERDICTS).forEach((v) => expect(v.toLowerCase()).not.toContain('safe'));
    const r = score({
      tactics: [tactic('urgency'), tactic('threat'), tactic('reward'), tactic('other')],
      requested_actions: ['share_otp', 'make_payment', 'click_link', 'call_number', 'install_app'],
      urlResults: checkUrls(['http://1.2.3.4/a.apk', 'bit.ly/x', 'https://sbi-kyc.top'], findEntity('SBI')),
    });
    expect(JSON.stringify(r).toLowerCase()).not.toContain('safe');
  });
});
