const request = require('supertest');
const app = require('../server');

test('GET /api/health returns the health status', () => {
  return request(app)
    .get('/api/health')
    .expect(200)
    .expect({ status: 'ok' });
});
