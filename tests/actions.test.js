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

  test('returns Assamese headline and steps, keeping numbers and channels', () => {
    const card = getActionCard('paid', 'as');
    expect(card.headline).toMatch(/^এতিয়াই 1930 ত ফোন কৰক।/);
    expect(card.steps[0].text).toMatch(/1930/);
    expect(card.steps[0].text).not.toMatch(/[A-Za-z]{4,}/); // translated, not English
    expect(card.steps[0].channel.tel).toBe('1930');
  });

  test('returns Hindi steps', () => {
    const card = getActionCard('installed_app', 'hi');
    expect(card.steps.every((s) => /[ऀ-ॿ]/.test(s.text))).toBe(true);
  });

  test('falls back to English when a translation is missing', () => {
    const data = require('../data/actions.json');
    const step = data.states.nothing.steps[0];
    const saved = step.as;
    delete step.as;
    try {
      expect(getActionCard('nothing', 'as').steps[0].text).toBe(step.en);
    } finally {
      step.as = saved;
    }
  });

  test('unknown state or language is rejected', () => {
    expect(getActionCard('hacked', 'en')).toBeNull();
    expect(getActionCard('__proto__', 'en')).toBeNull();
    expect(getActionCard('paid', 'fr')).toBeNull();
  });
});
