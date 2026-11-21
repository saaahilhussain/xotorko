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

afterAll(() => {
  delete process.env.GEMINI_API_KEY;
});

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
});
