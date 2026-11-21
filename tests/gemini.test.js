const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerate } })),
  ThinkingLevel: { LOW: 'LOW' },
}));

const gemini = require('../services/gemini');

const TEXT = 'Your account will be blocked today. Click http://x.top now';
const valid = {
  claimed_sender: 'SBI',
  requested_actions: ['click_link'],
  language: 'en',
  tactics: [
    { type: 'threat', exact_span: 'Your account will be blocked today', explanation: 'Threatens a block.' },
    { type: 'urgency', exact_span: 'act within 1 hour', explanation: 'Not in the message.' },
  ],
  is_conversational_personal: false,
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  mockGenerate.mockReset();
  gemini._clearCache();
});

afterEach(() => {
  delete process.env.GEMINI_FALLBACK_MODELS;
  jest.useRealTimers();
});

afterAll(() => {
  delete process.env.GEMINI_API_KEY;
});

const apiError = (status) => Object.assign(new Error(`got status ${status}`), { name: 'ApiError', status });

describe('validateAnalysis', () => {
  test('drops tactics whose exact_span is not in the input', () => {
    const r = gemini.validateAnalysis(valid, TEXT);
    expect(r.tactics).toHaveLength(1);
    expect(r.tactics[0].exact_span).toBe('Your account will be blocked today');
  });

  test('rejects responses that break the schema', () => {
    expect(gemini.validateAnalysis({ ...valid, language: 'fr' }, TEXT)).toBeNull();
    expect(gemini.validateAnalysis({ ...valid, requested_actions: ['hack'] }, TEXT)).toBeNull();
    expect(gemini.validateAnalysis({ ...valid, tactics: 'x' }, TEXT)).toBeNull();
    expect(gemini.validateAnalysis(null, TEXT)).toBeNull();
  });

  test('replaces model explanations that say "safe"', () => {
    const r = gemini.validateAnalysis(
      { ...valid, tactics: [{ type: 'threat', exact_span: 'blocked today', explanation: 'Not safe at all.' }] },
      TEXT,
    );
    expect(r.tactics[0].explanation.toLowerCase()).not.toContain('safe');
  });
});

describe('describeError', () => {
  test('includes status, message and network cause, and redacts the key', () => {
    const apiErr = Object.assign(new Error('API key test-key not valid'), { name: 'ApiError', status: 400 });
    const line = gemini.describeError(apiErr, 'test-key');
    expect(line).toContain('status=400');
    expect(line).toContain('ApiError');
    expect(line).not.toContain('test-key');
    expect(line).toContain('[REDACTED]');

    const netErr = new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo'), { code: 'EAI_AGAIN' }) });
    expect(gemini.describeError(netErr)).toContain('cause=EAI_AGAIN');
    expect(gemini.describeError(new Error('timeout'))).toMatch(/^timeout after \d+ms$/);
  });
});

describe('analyzeMessage', () => {
  test('returns validated JSON and sends the system instruction separately', async () => {
    mockGenerate.mockResolvedValue({ text: JSON.stringify(valid) });
    const r = await gemini.analyzeMessage(TEXT);
    expect(r.claimed_sender).toBe('SBI');
    const call = mockGenerate.mock.calls[0][0];
    expect(call.model).toBe(process.env.GEMINI_MODEL || 'gemini-4-hydrogen');
    expect(call.config.systemInstruction).toBe(gemini.SYSTEM_INSTRUCTION);
    expect(call.config.responseMimeType).toBe('application/json');
    expect(JSON.stringify(call.contents)).toContain(TEXT);
    expect(JSON.stringify(call.contents)).not.toContain(gemini.SYSTEM_INSTRUCTION);
  });

  test('caches by masked text', async () => {
    mockGenerate.mockResolvedValue({ text: JSON.stringify(valid) });
    await gemini.analyzeMessage(TEXT);
    await gemini.analyzeMessage(TEXT);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('returns null on API error, invalid JSON, or missing key', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('boom'));
    expect(await gemini.analyzeMessage(TEXT)).toBeNull();
    mockGenerate.mockResolvedValueOnce({ text: 'not json' });
    expect(await gemini.analyzeMessage(TEXT)).toBeNull();
    delete process.env.GEMINI_API_KEY;
    expect(await gemini.analyzeMessage(TEXT)).toBeNull();
  });

  test('returns null after the 8 second timeout', async () => {
    jest.useFakeTimers();
    mockGenerate.mockReturnValue(new Promise(() => {}));
    const p = gemini.analyzeMessage(TEXT);
    await jest.advanceTimersByTimeAsync(gemini.TIMEOUT_MS + 1);
    expect(await p).toBeNull();
    jest.useRealTimers();
  });

  test('retries a 503 once after 1s, then falls back to the next model', async () => {
    jest.useFakeTimers();
    process.env.GEMINI_FALLBACK_MODELS = ' fallback-a , fallback-b ';
    const primary = gemini.getModels()[0];
    mockGenerate
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce({ text: JSON.stringify(valid) });
    const p = gemini.analyzeMessage(TEXT);
    await jest.advanceTimersByTimeAsync(gemini.RETRY_DELAY_MS * 3);
    const r = await p;
    expect(r.claimed_sender).toBe('SBI');
    expect(mockGenerate.mock.calls.map((c) => c[0].model)).toEqual([primary, primary, 'fallback-a', 'fallback-a']);
  });

  test('does not retry or fall back on non-retryable errors', async () => {
    process.env.GEMINI_FALLBACK_MODELS = 'fallback-a';
    mockGenerate.mockRejectedValue(apiError(400));
    expect(await gemini.analyzeMessage(TEXT)).toBeNull();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test('returns null once the 12s total budget is used up', async () => {
    jest.useFakeTimers();
    process.env.GEMINI_FALLBACK_MODELS = 'fallback-a,fallback-b,fallback-c';
    mockGenerate.mockReturnValue(new Promise(() => {})); // every model hangs
    const p = gemini.analyzeMessage(TEXT);
    await jest.advanceTimersByTimeAsync(gemini.BUDGET_MS + 100);
    expect(await p).toBeNull();
    // 8s on the primary, the remaining 4s on fallback-a; fallback-b/c never called.
    expect(mockGenerate.mock.calls.map((c) => c[0].model)).toEqual([gemini.getModels()[0], 'fallback-a']);
  });

  test('model list: GEMINI_MODEL first, fallbacks deduplicated', () => {
    const prev = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'm1';
    process.env.GEMINI_FALLBACK_MODELS = 'm2,,m1, m3';
    expect(gemini.getModels()).toEqual(['m1', 'm2', 'm3']);
    if (prev === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prev;
  });
});
