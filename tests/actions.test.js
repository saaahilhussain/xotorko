const { getActionCard, STATES } = require('../lib/actions');

describe('actions', () => {
  test('all five states return a headline and steps', () => {
    expect(STATES).toEqual(['nothing', 'clicked', 'shared_otp', 'paid', 'installed_app']);
    for (const s of STATES) {
      const card = getActionCard(s, 'en');
      expect(card.headline).toEqual(expect.any(String));
      expect(card.steps.length).toBeGreaterThan(0);
      card.steps.forEach((step) => expect(step.text).toEqual(expect.any(String)));
    }
  });

  test('paid includes the 1930 helpline as a tel channel', () => {
    const card = getActionCard('paid', 'en');
    expect(card.steps.some((s) => s.channel && s.channel.tel === '1930')).toBe(true);
  });

  test('resolves url channels', () => {
    const card = getActionCard('paid', 'en');
    expect(card.steps.some((s) => s.channel && s.channel.url === 'https://cybercrime.gov.in')).toBe(true);
  });

  test('uses translations when present and falls back to English for steps', () => {
    const card = getActionCard('paid', 'as');
    expect(card.headline).toBe('এতিয়াই 1930 ত ফোন কৰক।');
    expect(card.steps[0].text).toMatch(/1930/); // step has only English
  });

  test('unknown state or language is rejected', () => {
    expect(getActionCard('hacked', 'en')).toBeNull();
    expect(getActionCard('__proto__', 'en')).toBeNull();
    expect(getActionCard('paid', 'fr')).toBeNull();
  });
});
