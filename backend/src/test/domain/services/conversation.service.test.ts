/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationService } from '../../../domain/services/conversation.service';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository';
import { MessageRepository } from '../../../domain/repositories/messages.repository';
import { EmbeddingsRepository } from '../../../domain/repositories/embeddings.repository';
import { EmbeddingAdapter } from '../../../infrastructure/embedding-providers';
import { EmbeddingQueue } from '../../../domain/services/embeddingqueue';
import { IngestRequest } from '../../../schemas/conversation.schema';
import { Conversation } from '../../../infrastructure/db/schema';

describe('ConversationService', () => {
  const mockConversationRepository = {
    findByClaudeId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByIds: vi.fn(),
    findByDateRange: vi.fn(),
    findConversationWithoutEmbeddings: vi.fn(),
  } as unknown as ConversationRepository;

  const mockMessageRepository = {
    upsertMessages: vi.fn(),
    findByConversationIds: vi.fn(),
  } as unknown as MessageRepository;

  const mockEmbeddingsRepository = {
    compareEmbeddings: vi.fn(),
  } as unknown as EmbeddingsRepository;

  const mockEmbeddingClient = {
    embed: vi.fn(),
  } as unknown as EmbeddingAdapter;

  const mockEmbeddingQueue = {
    add: vi.fn(),
  } as unknown as EmbeddingQueue;

  let service: ConversationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConversationService(
      mockConversationRepository,
      mockMessageRepository,
      mockEmbeddingsRepository,
      mockEmbeddingClient,
      mockEmbeddingQueue
    );
  });

  describe('upsertConversations', () => {
    const baseConversation = {
      id: 'claude-conv-001',
      title: 'Test Conversation',
      created_at: '2024-01-15T10:30:00Z',
      messages: [
        { role: 'user' as const, content: 'Hello', timestamp: '2024-01-15T10:30:00Z' },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: '2024-01-15T10:30:15Z' },
      ],
    };

    it('should create a new conversation when it does not exist', async () => {
      const request: IngestRequest = { conversations: [baseConversation] };

      mockConversationRepository.findByClaudeId = vi.fn().mockResolvedValue(null);
      mockConversationRepository.create = vi.fn().mockResolvedValue({
        id: 'internal-uuid-001',
        claudeConversationId: 'claude-conv-001',
        title: 'Test Conversation',
        messageCount: 2,
        created_at: new Date('2024-01-15T10:30:00Z'),
        updated_at: new Date(),
      });
      mockMessageRepository.upsertMessages = vi.fn().mockResolvedValue(undefined);

      const result = await service.upsertConversations(request);

      expect(result).toEqual({ processed: 1, created: 1, updated: 0 });
      expect(mockConversationRepository.findByClaudeId).toHaveBeenCalledWith('claude-conv-001');
      expect(mockConversationRepository.create).toHaveBeenCalledWith({
        claudeConversationId: 'claude-conv-001',
        title: 'Test Conversation',
        messageCount: 2,
        created_at: new Date('2024-01-15T10:30:00Z'),
      });
      expect(mockMessageRepository.upsertMessages).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingQueue.add).toHaveBeenCalledWith('internal-uuid-001');
    });

    it('should update an existing conversation when message count changes', async () => {
      const request: IngestRequest = { conversations: [baseConversation] };

      const existingConversation: Conversation = {
        id: 'internal-uuid-001',
        claudeConversationId: 'claude-conv-001',
        title: 'Test Conversation',
        messageCount: 1, // Different from request (2 messages)
        created_at: new Date('2024-01-15T10:30:00Z'),
        updated_at: new Date(),
      };

      mockConversationRepository.findByClaudeId = vi.fn().mockResolvedValue(existingConversation);
      mockConversationRepository.update = vi.fn().mockResolvedValue(existingConversation);
      mockMessageRepository.upsertMessages = vi.fn().mockResolvedValue(undefined);

      const result = await service.upsertConversations(request);

      expect(result).toEqual({ processed: 1, created: 0, updated: 1 });
      expect(mockConversationRepository.update).toHaveBeenCalledWith('internal-uuid-001', {
        title: 'Test Conversation',
        messageCount: 2,
      });
      expect(mockMessageRepository.upsertMessages).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingQueue.add).toHaveBeenCalledWith('internal-uuid-001');
    });

    it('should skip conversation when message count is unchanged', async () => {
      const request: IngestRequest = { conversations: [baseConversation] };

      const existingConversation: Conversation = {
        id: 'internal-uuid-001',
        claudeConversationId: 'claude-conv-001',
        title: 'Test Conversation',
        messageCount: 2, // Same as request
        created_at: new Date('2024-01-15T10:30:00Z'),
        updated_at: new Date(),
      };

      mockConversationRepository.findByClaudeId = vi.fn().mockResolvedValue(existingConversation);

      const result = await service.upsertConversations(request);

      expect(result).toEqual({ processed: 0, created: 0, updated: 0 });
      expect(mockConversationRepository.update).not.toHaveBeenCalled();
      expect(mockMessageRepository.upsertMessages).not.toHaveBeenCalled();
      expect(mockEmbeddingQueue.add).not.toHaveBeenCalled();
    });

    it('should process multiple conversations correctly', async () => {
      const request: IngestRequest = {
        conversations: [
          baseConversation,
          {
            id: 'claude-conv-002',
            title: 'Second Conversation',
            created_at: '2024-01-16T10:00:00Z',
            messages: [
              { role: 'user' as const, content: 'Question', timestamp: '2024-01-16T10:00:00Z' },
            ],
          },
        ],
      };

      // First conversation is new
      mockConversationRepository.findByClaudeId = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockConversationRepository.create = vi.fn()
        .mockResolvedValueOnce({ id: 'internal-uuid-001', claudeConversationId: 'claude-conv-001' })
        .mockResolvedValueOnce({ id: 'internal-uuid-002', claudeConversationId: 'claude-conv-002' });

      mockMessageRepository.upsertMessages = vi.fn().mockResolvedValue(undefined);

      const result = await service.upsertConversations(request);

      expect(result).toEqual({ processed: 2, created: 2, updated: 0 });
      expect(mockConversationRepository.create).toHaveBeenCalledTimes(2);
      expect(mockEmbeddingQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should format messages with correct sequence numbers', async () => {
      const request: IngestRequest = { conversations: [baseConversation] };

      mockConversationRepository.findByClaudeId = vi.fn().mockResolvedValue(null);
      mockConversationRepository.create = vi.fn().mockResolvedValue({
        id: 'internal-uuid-001',
      });
      mockMessageRepository.upsertMessages = vi.fn().mockResolvedValue(undefined);

      await service.upsertConversations(request);

      expect(mockMessageRepository.upsertMessages).toHaveBeenCalledWith([
        {
          conversationId: 'internal-uuid-001',
          sequence_number: 0,
          role: 'user',
          content: 'Hello',
          created_at: new Date('2024-01-15T10:30:00Z'),
        },
        {
          conversationId: 'internal-uuid-001',
          sequence_number: 1,
          role: 'assistant',
          content: 'Hi there!',
          created_at: new Date('2024-01-15T10:30:15Z'),
        },
      ]);
    });
  });

  describe('searchConversations', () => {
    it('should return conversations matching the search query', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockConvEmbeddings = [
        { conversationId: 'conv-1', embedding: [0.1, 0.2, 0.3] },
        { conversationId: 'conv-2', embedding: [0.2, 0.3, 0.4] },
      ];
      const mockConversations = [
        { id: 'conv-1', title: 'TypeScript', created_at: new Date(), updated_at: new Date(), messageCount: 2 },
        { id: 'conv-2', title: 'React', created_at: new Date(), updated_at: new Date(), messageCount: 1 },
      ];
      const mockMessages = [
        { id: 1, conversationId: 'conv-1', role: 'user', content: 'Hello', sequence_number: 0 },
        { id: 2, conversationId: 'conv-1', role: 'assistant', content: 'Hi', sequence_number: 1 },
        { id: 3, conversationId: 'conv-2', role: 'user', content: 'Question', sequence_number: 0 },
      ];

      mockEmbeddingClient.embed = vi.fn().mockResolvedValue(mockEmbedding);
      mockEmbeddingsRepository.compareEmbeddings = vi.fn().mockResolvedValue(mockConvEmbeddings);
      mockConversationRepository.findByIds = vi.fn().mockResolvedValue(mockConversations);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue(mockMessages);

      const result = await service.searchConversations('typescript generics');

      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith('typescript generics');
      expect(mockEmbeddingsRepository.compareEmbeddings).toHaveBeenCalledWith(mockEmbedding);
      expect(mockConversationRepository.findByIds).toHaveBeenCalledWith(['conv-1', 'conv-2']);
      expect(mockMessageRepository.findByConversationIds).toHaveBeenCalledWith(['conv-1', 'conv-2']);

      expect(result).toHaveLength(2);
      expect(result[0].messages).toHaveLength(2);
      expect(result[1].messages).toHaveLength(1);
    });

    it('should return conversations with correctly associated messages', async () => {
      mockEmbeddingClient.embed = vi.fn().mockResolvedValue([0.1]);
      mockEmbeddingsRepository.compareEmbeddings = vi.fn().mockResolvedValue([
        { conversationId: 'conv-1' },
      ]);
      mockConversationRepository.findByIds = vi.fn().mockResolvedValue([
        { id: 'conv-1', title: 'Test', created_at: new Date(), updated_at: new Date(), messageCount: 2 },
      ]);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue([
        { conversationId: 'conv-1', role: 'user', content: 'Q1' },
        { conversationId: 'conv-1', role: 'assistant', content: 'A1' },
      ]);

      const result = await service.searchConversations('test');

      expect(result[0].id).toBe('conv-1');
      expect(result[0].messages).toHaveLength(2);
      expect(result[0].messages[0].content).toBe('Q1');
    });
  });

  describe('getConversationsByDateRange', () => {
    const mockConversations = [
      { id: 'conv-1', title: 'Jan 15', created_at: new Date('2024-01-15'), updated_at: new Date(), messageCount: 1 },
      { id: 'conv-2', title: 'Jan 16', created_at: new Date('2024-01-16'), updated_at: new Date(), messageCount: 1 },
    ];
    const mockMessages = [
      { conversationId: 'conv-1', role: 'user', content: 'Hello' },
      { conversationId: 'conv-2', role: 'user', content: 'Hi' },
    ];

    it('should return conversations within date range', async () => {
      mockConversationRepository.findByDateRange = vi.fn().mockResolvedValue(mockConversations);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue(mockMessages);

      const result = await service.getConversationsByDateRange(
        '2024-01-15T00:00:00Z',
        '2024-01-17T00:00:00Z'
      );

      expect(mockConversationRepository.findByDateRange).toHaveBeenCalledWith(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-17T00:00:00Z')
      );
      expect(result).toHaveLength(2);
    });

    it('should handle from date only', async () => {
      mockConversationRepository.findByDateRange = vi.fn().mockResolvedValue([mockConversations[1]]);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue([mockMessages[1]]);

      const result = await service.getConversationsByDateRange('2024-01-16T00:00:00Z', undefined);

      expect(mockConversationRepository.findByDateRange).toHaveBeenCalledWith(
        new Date('2024-01-16T00:00:00Z'),
        undefined
      );
      expect(result).toHaveLength(1);
    });

    it('should handle to date only', async () => {
      mockConversationRepository.findByDateRange = vi.fn().mockResolvedValue([mockConversations[0]]);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue([mockMessages[0]]);

      const result = await service.getConversationsByDateRange(undefined, '2024-01-15T23:59:59Z');

      expect(mockConversationRepository.findByDateRange).toHaveBeenCalledWith(
        undefined,
        new Date('2024-01-15T23:59:59Z')
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no conversations found', async () => {
      mockConversationRepository.findByDateRange = vi.fn().mockResolvedValue([]);
      mockMessageRepository.findByConversationIds = vi.fn().mockResolvedValue([]);

      const result = await service.getConversationsByDateRange('2025-01-01T00:00:00Z');

      expect(result).toEqual([]);
    });
  });

  describe('reloadQueue', () => {
    it('should add all conversations without embeddings to queue', async () => {
      const missingIds = ['conv-1', 'conv-2', 'conv-3'];
      mockConversationRepository.findConversationWithoutEmbeddings = vi.fn().mockResolvedValue(missingIds);

      await service.reloadQueue();

      expect(mockConversationRepository.findConversationWithoutEmbeddings).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingQueue.add).toHaveBeenCalledTimes(3);
      expect(mockEmbeddingQueue.add).toHaveBeenNthCalledWith(1, 'conv-1');
      expect(mockEmbeddingQueue.add).toHaveBeenNthCalledWith(2, 'conv-2');
      expect(mockEmbeddingQueue.add).toHaveBeenNthCalledWith(3, 'conv-3');
    });

    it('should not add anything when all conversations have embeddings', async () => {
      mockConversationRepository.findConversationWithoutEmbeddings = vi.fn().mockResolvedValue([]);

      await service.reloadQueue();

      expect(mockEmbeddingQueue.add).not.toHaveBeenCalled();
    });
  });
});
