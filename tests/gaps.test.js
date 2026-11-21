// Coverage gaps: error classification, empty/invalid model output, demo cache
// size, i18n placeholders and server error paths.
const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerate } })),
  ThinkingLevel: { LOW: 'LOW', MINIMAL: 'MINIMAL' },
}));

const path = require('node:path');
const gemini = require('../services/gemini');
const quota = require('../services/quota');
const demoCache = require('../services/demoCache');
const I18N = require('../public/i18n');

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  mockGenerate.mockReset();
  gemini._clearCache();
  quota._reset();
});
afterAll(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('errorStatus', () => {
  test.each([
    [{ status: 503 }, 503],
    [new Error('got status 429 from server'), 429],
    [new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), 503],
    [new Error('RESOURCE_EXHAUSTED: quota'), 429],
    [new Error('UNAVAILABLE: model overloaded'), 503],
    [new Error('request id 45031 failed'), undefined], // digits inside a number are not a status
    [new Error('boom'), undefined],
    [null, undefined],
  ])('%p -> %p', (err, expected) => {
    expect(gemini.errorStatus(err)).toBe(expected);
  });
});

describe('analyzeMessage edge cases', () => {
  test('empty model response returns null without trying other models', async () => {
    process.env.GEMINI_FALLBACK_MODELS = 'fallback-a';
    mockGenerate.mockResolvedValue({ text: '' });
    expect(await gemini.analyzeMessage('hello')).toBeNull();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    delete process.env.GEMINI_FALLBACK_MODELS;
  });

  test('JSON that fails the schema returns null', async () => {
    mockGenerate.mockResolvedValue({ text: JSON.stringify({ language: 'xx' }) });
    expect(await gemini.analyzeMessage('hello')).toBeNull();
  });

  test('a 503 reported only in the message text is still retried', async () => {
    jest.useFakeTimers();
    mockGenerate
      .mockRejectedValueOnce(new Error('UNAVAILABLE: model overloaded'))
      .mockResolvedValueOnce({ text: JSON.stringify({ claimed_sender: null, requested_actions: ['none'], language: 'en', tactics: [], is_conversational_personal: true }) });
    const p = gemini.analyzeMessage('hi there');
    await jest.advanceTimersByTimeAsync(gemini.RETRY_DELAY_MS + 10);
    expect(await p).not.toBeNull();
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('non-string or empty input returns null without a call', async () => {
    expect(await gemini.analyzeMessage('')).toBeNull();
    expect(await gemini.analyzeMessage(42)).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('isConfigured follows GEMINI_API_KEY', () => {
    expect(gemini.isConfigured()).toBe(true);
    delete process.env.GEMINI_API_KEY;
    expect(gemini.isConfigured()).toBe(false);
  });

  test('validateAnalysis rejects malformed tactics and keeps the first of duplicates', () => {
    const base = { claimed_sender: '  SBI  ', requested_actions: ['none', 'click_link'], language: 'en', is_conversational_personal: false };
    expect(gemini.validateAnalysis({ ...base, tactics: [{ type: 'urgency' }] }, 'x')).toBeNull();
    const r = gemini.validateAnalysis({
      ...base,
      tactics: [
        { type: 'urgency', exact_span: 'now', explanation: 'a' },
        { type: 'urgency', exact_span: 'now', explanation: 'b' },
        { type: 'threat', exact_span: '   ', explanation: 'c' },
      ],
    }, 'act now');
    expect(r.tactics).toHaveLength(1);
    expect(r.claimed_sender).toBe('SBI');
    expect(r.requested_actions).toEqual(['click_link']);
  });
});

describe('demoCache', () => {
  test('size() reports loaded entries; entries failing validation are skipped', () => {
    const file = path.join(__dirname, '..', 'data', 'demo_cache.json');
    demoCache.load(file);
    const shipped = demoCache.size();
    expect(shipped).toBe(Object.keys(require('../data/demo_cache.json')).length);
    expect(shipped).toBeGreaterThanOrEqual(3); // s01, s02, s07 recorded for the demo
  });

  test('shipped cache entries are exactly the masked eval texts for s01, s02, s07', () => {
    const { mask, sanitizeInput } = require('../lib/sanitize');
    const items = require('./fixtures/eval.json').items;
    for (const id of ['s01', 's02', 's07']) {
      const masked = mask(sanitizeInput(items.find((i) => i.id === id).text).text);
      expect(demoCache.lookup(masked)).not.toBeNull();
    }
  });
});

describe('i18n.t', () => {
  test('fills placeholders and leaves unknown ones visible', () => {
    expect(I18N.t('en', 'call_btn', { tel: '1930' })).toBe('Call 1930');
    expect(I18N.t('en', 'call_btn', {})).toBe('Call {tel}');
    expect(I18N.t('hi', 'call_btn', { tel: '1930' })).toContain('1930');
  });

  test('every string with placeholders has the same placeholders in all languages', () => {
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const [key, en] of Object.entries(I18N.STRINGS.en)) {
      for (const lang of ['as', 'hi']) expect(`${key}:${ph(I18N.STRINGS[lang][key])}`).toBe(`${key}:${ph(en)}`);
    }
  });
});
