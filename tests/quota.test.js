const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerate } })),
  ThinkingLevel: { LOW: 'LOW', MINIMAL: 'MINIMAL' },
}));

const quota = require('../services/quota');
const gemini = require('../services/gemini');

const ok = {
  claimed_sender: null, requested_actions: ['none'], language: 'en', tactics: [], is_conversational_personal: false,
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  quota._reset();
  gemini._clearCache();
  mockGenerate.mockReset().mockResolvedValue({ text: JSON.stringify(ok) });
});
afterEach(() => {
  delete process.env.GEMINI_DAILY_LIMIT;
  delete process.env.GEMINI_THINKING_LEVEL;
});

describe('daily quota', () => {
  test('defaults to 300 and honours GEMINI_DAILY_LIMIT', () => {
    expect(quota.status().limit).toBe(300);
    process.env.GEMINI_DAILY_LIMIT = '2';
    expect(quota.status().limit).toBe(2);
    process.env.GEMINI_DAILY_LIMIT = 'nonsense';
    expect(quota.status().limit).toBe(300);
  });

  test('stops at the cap', () => {
    process.env.GEMINI_DAILY_LIMIT = '2';
    const now = Date.UTC(2026, 10, 21, 6, 0);
    expect(quota.tryConsume(now)).toBe(true);
    expect(quota.tryConsume(now)).toBe(true);
    expect(quota.tryConsume(now)).toBe(false);
  });

  test('resets at midnight IST, not UTC', () => {
    process.env.GEMINI_DAILY_LIMIT = '1';
    // 18:29 UTC = 23:59 IST on 21 Nov; 18:30 UTC = 00:00 IST on 22 Nov.
    const before = Date.UTC(2026, 10, 21, 18, 29);
    const after = Date.UTC(2026, 10, 21, 18, 30);
    expect(quota.istDate(before)).toBe('2026-11-21');
    expect(quota.istDate(after)).toBe('2026-11-22');
    expect(quota.tryConsume(before)).toBe(true);
    expect(quota.tryConsume(before)).toBe(false);
    expect(quota.tryConsume(after)).toBe(true);
  });

  test('past the cap, analyzeMessage returns null (limited mode) without calling Gemini', async () => {
    process.env.GEMINI_DAILY_LIMIT = '1';
    expect(await gemini.analyzeMessage('first message')).not.toBeNull();
    expect(await gemini.analyzeMessage('second message')).toBeNull();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('cache hits do not count against the cap', async () => {
    process.env.GEMINI_DAILY_LIMIT = '1';
    await gemini.analyzeMessage('same message');
    expect(await gemini.analyzeMessage('same message')).not.toBeNull();
    expect(quota.status().used).toBe(1);
  });
});

describe('request cost settings', () => {
  test('caps output tokens at 1024 and uses LOW thinking by default', async () => {
    await gemini.analyzeMessage('hello');
    const { config } = mockGenerate.mock.calls[0][0];
    expect(config.maxOutputTokens).toBe(1024);
    expect(config.thinkingConfig.thinkingLevel).toBe('LOW');
  });

  test('GEMINI_THINKING_LEVEL=minimal is honoured; unknown values fall back to LOW', () => {
    process.env.GEMINI_THINKING_LEVEL = 'minimal';
    expect(gemini.thinkingLevel()).toBe('MINIMAL');
    process.env.GEMINI_THINKING_LEVEL = 'HIGH';
    expect(gemini.thinkingLevel()).toBe('LOW');
  });
});
