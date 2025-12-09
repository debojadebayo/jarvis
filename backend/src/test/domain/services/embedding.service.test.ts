/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../../../domain/services/embedding.service';
import { EmbeddingQueue } from '../../../domain/services/embeddingqueue';
import { MessageRepository } from '../../../domain/repositories/messages.repository';
import { EmbeddingsRepository } from '../../../domain/repositories/embeddings.repository';
import { EmbeddingAdapter } from '../../../infrastructure/embedding-providers';
import { Message } from '../../../infrastructure/db/schema';

describe('EmbeddingService', () => {
  // Mock dependencies
  const mockMessageRepository = {
    findByConversationId: vi.fn(),
  } as unknown as MessageRepository;

  const mockEmbeddingsRepository = {
    upsert: vi.fn(),
  } as unknown as EmbeddingsRepository;

  const mockEmbeddingClient = {
    embed: vi.fn(),
  } as unknown as EmbeddingAdapter;

  const mockEmbeddingQueue = {
    processNext: vi.fn(),
  } as unknown as EmbeddingQueue;

  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmbeddingService(
      mockMessageRepository,
      mockEmbeddingsRepository,
      mockEmbeddingClient,
      mockEmbeddingQueue
    );
  });

  describe('processNextConversation', () => {
    const mockMessages: Message[] = [
      {
        id: "1",
        conversationId: 'conv-123',
        role: 'user',
        content: 'Hello',
        sequence_number: 1,
        created_at: new Date(),
      },
      {
        id: "2",
        conversationId: 'conv-123',
        role: 'assistant',
        content: 'Hi there!',
        sequence_number: 2,
        created_at: new Date(),
      },
    ];

    const mockEmbedding = [0.1, 0.2, 0.3, 0.4];

    it('should process a conversation successfully', async () => {
      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue('conv-123');
      mockMessageRepository.findByConversationId = vi.fn().mockResolvedValue(mockMessages);
      mockEmbeddingClient.embed = vi.fn().mockResolvedValue(mockEmbedding);
      mockEmbeddingsRepository.upsert = vi.fn().mockResolvedValue({});

      await service.processNextConversation();

      expect(mockEmbeddingQueue.processNext).toHaveBeenCalledTimes(1);
      expect(mockMessageRepository.findByConversationId).toHaveBeenCalledWith('conv-123');
      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith('user: Hello\nassistant: Hi there!');
      expect(mockEmbeddingsRepository.upsert).toHaveBeenCalledWith('conv-123', mockEmbedding);
    });

    it('should return early when queue is empty', async () => {
      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue(undefined);

      await service.processNextConversation();

      expect(mockEmbeddingQueue.processNext).toHaveBeenCalledTimes(1);
      expect(mockMessageRepository.findByConversationId).not.toHaveBeenCalled();
      expect(mockEmbeddingClient.embed).not.toHaveBeenCalled();
      expect(mockEmbeddingsRepository.upsert).not.toHaveBeenCalled();
    });

    it('should throw error when no messages found', async () => {
      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue('conv-456');
      mockMessageRepository.findByConversationId = vi.fn().mockResolvedValue([]);

      await expect(service.processNextConversation()).rejects.toThrow(
        'No messages found for conversation ID: conv-456'
      );

      expect(mockEmbeddingClient.embed).not.toHaveBeenCalled();
      expect(mockEmbeddingsRepository.upsert).not.toHaveBeenCalled();
    });

    it('should combine messages in correct format for embedding', async () => {
      const multipleMessages: Message[] = [
        { id: "1", conversationId: 'conv-789', role: 'user', content: 'Question 1', sequence_number: 1, created_at: new Date() },
        { id: "2", conversationId: 'conv-789', role: 'assistant', content: 'Answer 1', sequence_number: 2, created_at: new Date() },
        { id: "3", conversationId: 'conv-789', role: 'user', content: 'Question 2', sequence_number: 3, created_at: new Date() },
      ];

      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue('conv-789');
      mockMessageRepository.findByConversationId = vi.fn().mockResolvedValue(multipleMessages);
      mockEmbeddingClient.embed = vi.fn().mockResolvedValue(mockEmbedding);
      mockEmbeddingsRepository.upsert = vi.fn().mockResolvedValue({});

      await service.processNextConversation();

      expect(mockEmbeddingClient.embed).toHaveBeenCalledWith(
        'user: Question 1\nassistant: Answer 1\nuser: Question 2'
      );
    });

    it('should propagate embedding client errors', async () => {
      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue('conv-123');
      mockMessageRepository.findByConversationId = vi.fn().mockResolvedValue(mockMessages);
      mockEmbeddingClient.embed = vi.fn().mockRejectedValue(new Error('API rate limit'));

      await expect(service.processNextConversation()).rejects.toThrow('API rate limit');
    });

    it('should propagate repository errors', async () => {
      mockEmbeddingQueue.processNext = vi.fn().mockReturnValue('conv-123');
      mockMessageRepository.findByConversationId = vi.fn().mockResolvedValue(mockMessages);
      mockEmbeddingClient.embed = vi.fn().mockResolvedValue(mockEmbedding);
      mockEmbeddingsRepository.upsert = vi.fn().mockRejectedValue(new Error('DB connection failed'));

      await expect(service.processNextConversation()).rejects.toThrow('DB connection failed');
    });
  });
});