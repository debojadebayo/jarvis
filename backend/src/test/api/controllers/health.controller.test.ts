/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { HealthController } from '../../../api/controllers/health.controllers';

// Mock the db testConnection function
vi.mock('../../../infrastructure/db', () => ({
  testConnection: vi.fn(),
}));

describe('HealthController', () => {
  let app: FastifyInstance;
  let controller: HealthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    controller = new HealthController();
    app = Fastify({ logger: false });

    app.get('/health', controller.checkHealth.bind(controller));
    app.get('/dbhealth', controller.checkDbHealth.bind(controller));

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
    });
  });

  describe('GET /dbhealth', () => {
    it('should return 200 when database is connected', async () => {
      const { testConnection } = await import('../../../infrastructure/db');
      vi.mocked(testConnection).mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/dbhealth',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        status: 'Ok',
        database: 'Connected',
      });
    });

    it('should return 503 when database is disconnected', async () => {
      const { testConnection } = await import('../../../infrastructure/db');
      vi.mocked(testConnection).mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/dbhealth',
      });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.payload)).toEqual({
        status: 'Degraded',
        database: 'Disconnected',
      });
    });
  });
});
