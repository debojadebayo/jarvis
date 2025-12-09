/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ConversationController } from '../../../api/controllers/conversation.controller';
import { ConversationService } from '../../../domain/services/conversation.service';
import {
  ingestRequestSchema,
  IngestRequest,
  dateRangeRequestSchema,
  DateRangeRequest
} from '../../../schemas/conversation.schema';
import { validate } from '../../../api/middleware/validate';
import { errorHandler } from '../../../api/middleware/error-handler';


vi.mock('../../../api/middleware/auth', () => ({
  authenticate: vi.fn(async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const token = authHeader.substring(7);
    if (token !== 'test-api-key-min-16-chars') {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }
    request.authenticated = true;
  }),
}));

const mockConversationService = {
  upsertConversations: vi.fn(),
  searchConversations: vi.fn(),
  getConversationsByDateRange: vi.fn(),
} as unknown as ConversationService;

describe('ConversationController - Ingest Endpoint', () => {
  let app: FastifyInstance;
  let controller: ConversationController;
  const API_KEY = 'test-api-key-min-16-chars';

  beforeEach(async () => {
    vi.clearAllMocks();

    controller = new ConversationController(mockConversationService);

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);

    const { authenticate } = await import('../../../api/middleware/auth');

    app.post<{ Body: IngestRequest }>(
      '/api/v1/conversations/',
      { preHandler: [authenticate, validate(ingestRequestSchema, 'body')] },
      controller.ingest.bind(controller)
    );

    app.get<{ Querystring: DateRangeRequest }>(
      '/api/v1/conversations/date-range',
      { preHandler: [authenticate, validate(dateRangeRequestSchema, 'query')] },
      controller.dateRange.bind(controller)
    );

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        payload: { conversations: [] },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: 'Basic sometoken' },
        payload: { conversations: [] },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Unauthorized' });
    });

    it('should return 403 when token is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: 'Bearer wrong-token' },
        payload: { conversations: [] },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Forbidden' });
    });
  });

  describe('Validation', () => {
    it('should return 400 when conversations array is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: { conversations: [] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when conversation is missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test',
              title: 'Missing messages',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when message content is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv',
              title: 'Test Conversation',
              created_at: '2024-01-15T10:30:00Z',
              messages: [
                {
                  role: 'user',
                  content: '',
                  timestamp: '2024-01-15T10:30:00Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when timestamp format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv',
              title: 'Test Conversation',
              created_at: 'invalid-date',
              messages: [
                {
                  role: 'user',
                  content: 'Hello',
                  timestamp: '2024-01-15T10:30:00Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when role is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv',
              title: 'Test Conversation',
              created_at: '2024-01-15T10:30:00Z',
              messages: [
                {
                  role: 'system',
                  content: 'Hello',
                  timestamp: '2024-01-15T10:30:00Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Successful Ingestion', () => {
    it('should ingest a single conversation successfully', async () => {
      mockConversationService.upsertConversations = vi.fn().mockResolvedValue({
        processed: 1,
        created: 1,
        updated: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv-001',
              title: 'Test Conversation About TypeScript',
              created_at: '2024-01-15T10:30:00Z',
              messages: [
                {
                  role: 'user',
                  content: 'How do I use TypeScript generics?',
                  timestamp: '2024-01-15T10:30:00Z',
                },
                {
                  role: 'assistant',
                  content: 'TypeScript generics allow you to write reusable code...',
                  timestamp: '2024-01-15T10:30:15Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        success: true,
        processed: 1,
        created: 1,
        updated: 0,
      });
      expect(mockConversationService.upsertConversations).toHaveBeenCalledTimes(1);
    });

    it('should ingest multiple conversations successfully', async () => {
      mockConversationService.upsertConversations = vi.fn().mockResolvedValue({
        processed: 2,
        created: 2,
        updated: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv-002',
              title: 'React Hooks Discussion',
              created_at: '2024-01-16T14:00:00Z',
              messages: [
                {
                  role: 'user',
                  content: 'Explain useEffect cleanup functions',
                  timestamp: '2024-01-16T14:00:00Z',
                },
                {
                  role: 'assistant',
                  content: 'The cleanup function in useEffect runs before unmount...',
                  timestamp: '2024-01-16T14:00:20Z',
                },
              ],
            },
            {
              id: 'test-conv-003',
              title: 'Database Design Chat',
              created_at: '2024-01-17T09:00:00Z',
              messages: [
                {
                  role: 'user',
                  content: 'What is database normalization?',
                  timestamp: '2024-01-17T09:00:00Z',
                },
                {
                  role: 'assistant',
                  content: 'Database normalization is the process of organizing data...',
                  timestamp: '2024-01-17T09:00:30Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        success: true,
        processed: 2,
        created: 2,
        updated: 0,
      });
    });

    it('should handle upsert (update existing conversation)', async () => {
      mockConversationService.upsertConversations = vi.fn().mockResolvedValue({
        processed: 1,
        created: 0,
        updated: 1,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations/',
        headers: { authorization: `Bearer ${API_KEY}` },
        payload: {
          conversations: [
            {
              id: 'test-conv-001',
              title: 'Test Conversation About TypeScript',
              created_at: '2024-01-15T10:30:00Z',
              messages: [
                {
                  role: 'user',
                  content: 'How do I use TypeScript generics?',
                  timestamp: '2024-01-15T10:30:00Z',
                },
                {
                  role: 'assistant',
                  content: 'TypeScript generics allow you to write reusable code...',
                  timestamp: '2024-01-15T10:30:15Z',
                },
                {
                  role: 'user',
                  content: 'Can you show me an example?',
                  timestamp: '2024-01-15T10:31:00Z',
                },
                {
                  role: 'assistant',
                  content: 'Sure! Here is an example of a generic function...',
                  timestamp: '2024-01-15T10:31:30Z',
                },
              ],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        success: true,
        processed: 1,
        created: 0,
        updated: 1,
      });
    });
  });

  describe('Date Range Query', () => {
    const mockConversations = [
      {
        id: 1,
        title: 'TypeScript Discussion',
        created_at: new Date('2024-01-15T10:30:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
        messageCount: 2,
        messages: [
          { role: 'user', content: 'Hello', conversationId: 1 },
          { role: 'assistant', content: 'Hi there', conversationId: 1 },
        ],
      },
      {
        id: 2,
        title: 'React Discussion',
        created_at: new Date('2024-01-16T14:00:00Z'),
        updated_at: new Date('2024-01-16T14:00:00Z'),
        messageCount: 2,
        messages: [
          { role: 'user', content: 'React question', conversationId: 2 },
          { role: 'assistant', content: 'React answer', conversationId: 2 },
        ],
      },
    ];

    it('should return conversations within date range', async () => {
      mockConversationService.getConversationsByDateRange = vi.fn().mockResolvedValue(mockConversations);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
        query: {
          from: '2024-01-15T00:00:00Z',
          to: '2024-01-17T23:59:59Z',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('should return conversations from a specific date onwards', async () => {
      mockConversationService.getConversationsByDateRange = vi.fn().mockResolvedValue([mockConversations[1]]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
        query: {
          from: '2024-01-16T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('should return conversations up to a specific date', async () => {
      mockConversationService.getConversationsByDateRange = vi.fn().mockResolvedValue([mockConversations[0]]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
        query: {
          to: '2024-01-15T23:59:59Z',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('should return 400 when no date parameters provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when date format is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
        query: {
          from: 'invalid-date',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return empty array when no conversations in range', async () => {
      mockConversationService.getConversationsByDateRange = vi.fn().mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        headers: { authorization: `Bearer ${API_KEY}` },
        query: {
          from: '2025-01-01T00:00:00Z',
          to: '2025-12-31T23:59:59Z',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/date-range',
        query: {
          from: '2024-01-15T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
