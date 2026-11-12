import { describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.DEMO_MODE = 'true';
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-test';
process.env.WEB_ORIGIN = 'https://mali-scope.vercel.app/';
const { default: app, initialiseDemoAdmin } = await import('./app.js');
await initialiseDemoAdmin();

describe('MaliScope API', () => {
  it('does not initialize the demo administrator in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(initialiseDemoAdmin()).rejects.toThrow('Demo administrator initialization is disabled in production.');
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('reports health and marks demo market data', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.marketData).toBe('illustrative-demo');
  });
  it('returns API information at the root path', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'MaliScope API',
      message: 'API is running.',
      health: '/api/health'
    });
  });
  it('accepts preflight requests for a configured origin with a trailing slash', async () => {
    const response = await request(app)
      .options('/api/dashboard')
      .set('Origin', 'https://mali-scope.vercel.app')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://mali-scope.vercel.app');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
  it('returns course catalogue', async () => {
    const response = await request(app).get('/api/academy/courses');
    expect(response.status).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
  });
  it('does not allow paper trade without authentication', async () => {
    const response = await request(app).post('/api/practice/trades').send({ symbol: 'SCOM', side: 'buy', quantity: 1 });
    expect(response.status).toBe(401);
  });
});

it('registers a learner and enforces virtual portfolio limits', async () => {
  const learner = request.agent(app);
  const registered = await learner.post('/api/auth/register').send({
    name: 'Practice Learner',
    email: 'practice-learner@example.test',
    password: 'LearningSecure123!'
  });
  expect(registered.status).toBe(201);

  const purchase = await learner.post('/api/practice/trades').send({ symbol: 'SCOM', side: 'buy', quantity: 10 });
  expect(purchase.status).toBe(201);
  expect(purchase.body.cash).toBeLessThan(100000);

  const oversell = await learner.post('/api/practice/trades').send({ symbol: 'SCOM', side: 'sell', quantity: 11 });
  expect(oversell.status).toBe(400);
});
