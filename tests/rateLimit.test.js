const request = require('supertest');
const app = require('../server');

test('rate limits /api to 30 requests per minute per IP', async () => {
  for (let i = 0; i < 30; i += 1) {
    await request(app).get('/api/health').expect(200);
  }
  const res = await request(app).get('/api/health').expect(429);
  expect(res.body.error).toMatch(/Too many requests/);
});
