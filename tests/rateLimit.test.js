jest.mock('../services/gemini', () => ({ ...jest.requireActual('../services/gemini'), analyzeMessage: jest.fn().mockResolvedValue(null) }));

const request = require('supertest');
const app = require('../server');

// Each test uses its own client IP (trust proxy = 1) so the windows don't interact.
const ip = (n) => ({ 'X-Forwarded-For': `203.0.113.${n}` });

test('rate limits /api to 30 requests per minute per IP', async () => {
  for (let i = 0; i < 30; i += 1) {
    await request(app).get('/api/health').set(ip(1)).expect(200);
  }
  const res = await request(app).get('/api/health').set(ip(1)).expect(429);
  expect(res.body.error).toMatch(/Too many requests/);
});

test('rate limits /api/analyze to 10 per minute per IP', async () => {
  for (let i = 0; i < 10; i += 1) {
    await request(app).post('/api/analyze').set(ip(2)).send({ text: `hello ${i}` }).expect(200);
  }
  const res = await request(app).post('/api/analyze').set(ip(2)).send({ text: 'hello' }).expect(429);
  expect(res.body.error).toMatch(/Too many checks/);
  expect(res.headers).toHaveProperty('ratelimit-policy');
});

test('the analyze limit does not block other routes for the same IP', async () => {
  for (let i = 0; i < 11; i += 1) await request(app).post('/api/analyze').set(ip(3)).send({ text: 'x' });
  await request(app).get('/api/health').set(ip(3)).expect(200);
  await request(app).get('/api/actions/paid').set(ip(3)).expect(200);
});
