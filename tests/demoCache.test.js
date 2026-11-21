jest.mock('../services/gemini', () => ({ ...jest.requireActual('../services/gemini'), analyzeMessage: jest.fn() }));

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const gemini = require('../services/gemini');
const demoCache = require('../services/demoCache');
const { analyzeText } = require('../lib/analyze');
const { mask } = require('../lib/sanitize');

const TEXT = 'Your electricity power will be disconnected tonight. Call officer 9000000011 immediately.';
const MASKED = mask(TEXT);
const analysis = {
  claimed_sender: 'APDCL',
  requested_actions: ['call_number'],
  language: 'en',
  tactics: [
    { type: 'threat', exact_span: 'will be disconnected tonight', explanation: 'Threatens to cut power.' },
    { type: 'urgency', exact_span: 'not in the message', explanation: 'Dropped: ungrounded.' },
  ],
  is_conversational_personal: false,
};

let dir;
const writeCache = (obj) => {
  const file = path.join(dir, 'cache.json');
  fs.writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return file;
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xotorko-cache-'));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => gemini.analyzeMessage.mockReset());

test('the shipped data/demo_cache.json loads without error', () => {
  expect(() => demoCache.load()).not.toThrow();
});

test('empty, missing or malformed cache files are tolerated', () => {
  expect(demoCache.load(writeCache({})).size).toBe(0);
  expect(demoCache.load(writeCache('not json')).size).toBe(0);
  expect(demoCache.load(path.join(dir, 'missing.json')).size).toBe(0);
  expect(demoCache.lookup(MASKED)).toBeNull();
});

test('Gemini down + exact masked match: serves the cached analysis, not limited mode', async () => {
  demoCache.load(writeCache({ s01: { masked_text: MASKED, analysis } }));
  gemini.analyzeMessage.mockResolvedValue(null);
  const r = await analyzeText(TEXT);
  expect(r.limited_mode).toBe(false);
  expect(r.source).toBe('cache');
  expect(r.evidence.message.map((t) => t.exact_span)).toEqual(['will be disconnected tonight']);
  expect(r.evidence.behaviour).toEqual(['call_number']);
});

test('no cache hit when the text differs, and eval can opt out', async () => {
  demoCache.load(writeCache({ s01: { masked_text: MASKED, analysis } }));
  gemini.analyzeMessage.mockResolvedValue(null);
  const other = await analyzeText(`${TEXT} `.replace('tonight', 'today'));
  expect(other).toMatchObject({ limited_mode: true, source: 'rules' });
  const optOut = await analyzeText(TEXT, { demoCache: false });
  expect(optOut).toMatchObject({ limited_mode: true, source: 'rules' });
});

test('live Gemini wins over the cache', async () => {
  demoCache.load(writeCache({ s01: { masked_text: MASKED, analysis } }));
  gemini.analyzeMessage.mockResolvedValue({ ...analysis, tactics: [], source: 'gemini' });
  const r = await analyzeText(TEXT);
  expect(r.source).toBe('gemini');
});

test('limited mode now reports requested actions from heuristics', async () => {
  gemini.analyzeMessage.mockResolvedValue(null);
  const r = await analyzeText('Your power will be cut tonight. Call officer 9000000011 immediately.', { demoCache: false });
  expect(r.limited_mode).toBe(true);
  expect(r.evidence.behaviour).toEqual(['call_number']);
});
