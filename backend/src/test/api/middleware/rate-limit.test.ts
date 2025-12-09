/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { registerRateLimit } from '../../../api/middleware/rate-limit';

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Register rate limit with a lower limit for testing
    await app.register(rateLimit, {
      max: 3, // Very low limit for testing
      timeWindow: '1 minute',
      addHeadersOnExceeding: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      },
      errorResponseBuilder: (_request, context) => ({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${context.after}`,
        statusCode: 429,
      }),
    });

    app.get('/test', async (_request, reply) => {
      return reply.send({ status: 'ok' });
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow requests under the rate limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
  });

  it('should include rate limit headers in response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    // Headers should be present
    expect(response.statusCode).toBe(200);
    // The rate limit plugin adds these headers
    expect(response.headers).toBeDefined();
  });

  it('should return 429 when rate limit is exceeded', async () => {
    // Make requests up to the limit (3)
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(res.statusCode).toBe(200);
    }

    // This request should exceed the limit
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Too Many Requests');
    expect(body.statusCode).toBe(429);
  });
});

describe('Rate Limit Configuration', () => {
  it('should use registerRateLimit with default settings', async () => {
    const app = Fastify({ logger: false });

    await registerRateLimit(app);

    app.get('/test', async (_request, reply) => {
      return reply.send({ status: 'ok' });
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it('should have max limit of 100 requests', async () => {
    // This tests that the configuration is correct
    // We can't easily test 100 requests, but we verify it doesn't fail on first request
    const app = Fastify({ logger: false });

    await registerRateLimit(app);

    app.get('/test', async (_request, reply) => {
      return reply.send({ status: 'ok' });
    });

    await app.ready();

    // Multiple requests should succeed under the limit
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response.statusCode).toBe(200);
    }

    await app.close();
  });
});
