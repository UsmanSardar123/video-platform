const request = require('supertest');
const express = require('express');
const app = require('../../app');
const errorHandler = require('../../middleware/error.middleware');
const ApiError = require('../../utils/apiError.util');

describe('Backend Infrastructure Tests', () => {
  describe('GET /api/health', () => {
    it('should return 200 with health metadata', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toBe('API is healthy');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.environment).toBeDefined();
      expect(res.body.data.timestamp).toBeDefined();
      expect(typeof res.body.data.uptime).toBe('number');
    });
  });

  describe('404 Route Not Found Handler', () => {
    it('should return consistent 404 for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(404);
      expect(res.body.message).toMatch(/Route not found/);
    });
  });

  describe('Centralized Error Handling & Production Masking', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app).get('/api/non-existent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.stack).toBeUndefined();
    });

    it('should mask 500 error messages and omit stack trace in production', async () => {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/test-500', (req, res, next) => {
        next(new Error('Internal database connection failure secret_key_123'));
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/test-500');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Internal Server Error');
      expect(res.body.message).not.toContain('secret_key_123');
      expect(res.body.stack).toBeUndefined();
    });

    it('should format custom ApiError with status and errors array', async () => {
      const testApp = express();
      testApp.get('/test-apierror', (req, res, next) => {
        next(new ApiError(400, 'Invalid request input', [{ field: 'email', message: 'Required' }]));
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/test-apierror');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid request input');
      expect(res.body.errors).toEqual([{ field: 'email', message: 'Required' }]);
    });
  });
});
