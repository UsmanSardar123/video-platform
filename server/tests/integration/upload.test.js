const request = require('supertest');

describe('protected upload API contract', () => {
  test('requires authentication for signatures, completion, external links and current-user videos', async () => {
    const app = require('../../app');
    const cases = [
      ['post', '/api/uploads/signature', {}],
      ['post', '/api/uploads/complete', {}],
      ['post', '/api/external-videos', {}],
      ['get', '/api/videos/mine'],
    ];
    for (const [method, path, body] of cases) {
      const response = await request(app)[method](path).send(body);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ success: false, message: 'Authentication required' });
    }
  });
});
