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

const { detectRequestedActions } = require('../lib/heuristics');
const asks = (t) => detectRequestedActions(t);

describe('detectRequestedActions (limited mode)', () => {
  describe('call_number: a call/contact verb near a phone number', () => {
    test.each([
      ['English', 'Please immediately contact our electricity officer 9000000011.'],
      ['English, masked', 'Call [PHONE] now to avoid disconnection'],
      ['English, number first', 'Helpline [PHONE]. Call now or your SIM will be blocked'],
      ['WhatsApp link', 'Contact on WhatsApp wa.me/919000000014'],
      ['Hinglish', 'Turant is number pe call karein [PHONE]'],
      ['Hinglish sampark', '9000000011 par sampark karein'],
      ['romanised Assamese', 'ei number ot phone korok 9000000012'],
      ['Assamese script, যোগাযোগ কৰক', 'লগে লগে এই নম্বৰত যোগাযোগ কৰক 9000000012'],
      ['Assamese script, ফোন কৰক', 'এই নম্বৰত ফোন কৰক [PHONE]'],
      ['Hindi script', 'इस नंबर पर कॉल करें [PHONE]'],
    ])('%s', (_, text) => {
      expect(asks(text)).toContain('call_number');
    });

    test.each([
      ['no number nearby', 'Not you? Call the number on your card. -HDFC Bank'],
      ['negated', 'Never call [PHONE] or reply to this message'],
      ['number but no call verb', 'PNR 4521367890 Train 15959 CNF'],
      ['verb far from the number', `Call us any time. ${'x'.repeat(80)} Ref 9876543210`],
      ['the verb is only part of a word', 'Product recall notice. Ref [PHONE]'],
      ['the verb is only part of a word (prefix)', 'Free upcall offer [PHONE]'],
    ])('not when %s', (_, text) => {
      expect(asks(text)).not.toContain('call_number');
    });
  });

  describe('share_otp', () => {
    test.each([
      'Please share the OTP you received to complete verification',
      'tell me the code that came on your phone',
      'Enter your UPI PIN to receive the money',
      'OTP batao jaldi',
      'আপোনাৰ মোবাইলত অহা OTP দিয়ক',
      'जो OTP आया है वो OTP बताएं',
    ])('%s', (text) => {
      expect(asks(text)).toContain('share_otp');
    });

    test.each([
      '482913 is your OTP. Do not share this OTP with anyone.',
      'SBI never asks for OTP, PIN or password.',
      'Use 771204 as OTP to log in. Kotak never asks for your OTP over call.',
    ])('not for OTP deliveries or warnings: %s', (text) => {
      expect(asks(text)).not.toContain('share_otp');
    });
  });

  describe('make_payment', () => {
    test.each([
      'Pay Rs 99 processing fee to release your parcel',
      'Pay a small registration fee of ₹500',
      'Transfer money to this account to avoid arrest',
      'Send Rs 2000 via UPI to claim the prize',
      'paise bhejo abhi',
      'এই UPI ত ১০,০০০ টকা পঠিয়াই দিয়া',
      'तुरंत भुगतान करें वरना कनेक्शन कट जाएगा',
    ])('%s', (text) => {
      expect(asks(text)).toContain('make_payment');
    });

    test.each([
      'Rs.1,250.00 debited from A/c XX4521 to VPA grocer@okaxis. UPI Ref 631245789012.',
      'Your APDCL bill of Rs 842 is generated. Pay via myBijulee app or apdcl.org. -DAPDCL',
      'Recharge via MyJio app to continue services.',
      'Never send money to anyone you met online.',
    ])('not for alerts, bills via official apps, or warnings: %s', (text) => {
      expect(asks(text)).not.toContain('make_payment');
    });
  });

  test('returns [] for empty or non-string input, and ordinary chat', () => {
    expect(asks('')).toEqual([]);
    expect(asks(null)).toEqual([]);
    expect(asks('মা, মই ৰাতি ৯ বজাত ঘৰ পাম।')).toEqual([]);
  });
});
