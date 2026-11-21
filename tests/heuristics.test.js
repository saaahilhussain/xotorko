const { detectTactics, guessClaimedSender } = require('../lib/heuristics');

const cats = (t) => detectTactics(t).map((x) => x.category);

describe('heuristics (limited mode only)', () => {
  test('English urgency + threat', () => {
    expect(cats('Your account will be blocked. Update immediately.')).toEqual(
      expect.arrayContaining(['urgency', 'threat']),
    );
  });

  test('Hinglish and romanised Assamese', () => {
    expect(cats('aapka account 24 ghante me band ho jayega')).toEqual(expect.arrayContaining(['urgency', 'threat']));
    expect(cats('apunar bijuli line aji rati kati dia hobo')).toEqual(expect.arrayContaining(['urgency', 'threat']));
  });

  test('Assamese script', () => {
    expect(cats('আপোনাৰ সংযোগ আজি নিশা বিচ্ছিন্ন কৰা হ\'ব')).toEqual(expect.arrayContaining(['urgency', 'threat']));
  });

  test('OTP requests, KYC, prize and digital arrest', () => {
    expect(cats('please tell me the code')).toContain('otp_request');
    expect(cats('Update your KYC')).toContain('kyc');
    expect(cats('Congratulations, lucky draw')).toContain('reward');
    expect(cats('You are under digital arrest')).toContain('threat');
  });

  test('negated OTP warnings are not requests', () => {
    expect(cats('Do not share this OTP with anyone.')).toEqual([]);
  });

  test('exact_span is verbatim from the text', () => {
    const text = 'URGENT: your SIM is BLOCKED';
    detectTactics(text).forEach((t) => expect(text).toContain(t.exact_span));
  });

  test('guesses the claimed sender from known entities', () => {
    expect(guessClaimedSender('Dear SBI Customer')).toBe('State Bank of India');
    expect(guessClaimedSender('hello friend')).toBeNull();
  });
});
