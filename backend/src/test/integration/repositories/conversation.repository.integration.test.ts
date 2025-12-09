import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository';
import { EmbeddingsRepository } from '../../../domain/repositories/embeddings.repository';
import {
  getTestDb,
  setupTestDatabase,
  truncateTables,
  closeTestDatabase,
  TestDatabase
} from '../helpers/test-db';

describe('ConversationRepository Integration Tests', () => {
  let db: TestDatabase;
  let repository: ConversationRepository;
  let embeddingsRepository: EmbeddingsRepository;

  beforeAll(async () => {
    db = await getTestDb();
    await setupTestDatabase();
    repository = new ConversationRepository(db);
    embeddingsRepository = new EmbeddingsRepository(db);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  describe('create', () => {
    it('should create a new conversation', async () => {
      const conversationData = {
        claudeConversationId: 'claude-123',
        title: 'Test Conversation',
        messageCount: 5,
      };

      const result = await repository.create(conversationData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.claudeConversationId).toBe('claude-123');
      expect(result.title).toBe('Test Conversation');
      expect(result.messageCount).toBe(5);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should fail when creating duplicate claudeConversationId', async () => {
      const conversationData = {
        claudeConversationId: 'claude-duplicate',
        title: 'First Conversation',
      };

      await repository.create(conversationData);

      await expect(
        repository.create({ ...conversationData, title: 'Second Conversation' })
      ).rejects.toThrow();
    });

    it('should use default title when not provided', async () => {
      const result = await repository.create({
        claudeConversationId: 'claude-no-title',
      });

      expect(result.title).toBe('Untitled Conversation');
    });
  });

  describe('findByClaudeId', () => {
    it('should find an existing conversation', async () => {
      const created = await repository.create({
        claudeConversationId: 'claude-find-me',
        title: 'Find Me',
      });

      const found = await repository.findByClaudeId('claude-find-me');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Find Me');
    });

    it('should return null for non-existent conversation', async () => {
      const found = await repository.findByClaudeId('does-not-exist');

      expect(found).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should find multiple conversations by their IDs', async () => {
      const conv1 = await repository.create({ claudeConversationId: 'claude-1' });
      const conv2 = await repository.create({ claudeConversationId: 'claude-2' });
      await repository.create({ claudeConversationId: 'claude-3' }); // not included

      const found = await repository.findByIds([conv1.id, conv2.id]);

      expect(found).toHaveLength(2);
      const ids = found.map(c => c.id);
      expect(ids).toContain(conv1.id);
      expect(ids).toContain(conv2.id);
    });

    it('should return empty array for empty input', async () => {
      const found = await repository.findByIds([]);

      expect(found).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update conversation fields', async () => {
      const created = await repository.create({
        claudeConversationId: 'claude-update',
        title: 'Original Title',
        messageCount: 0,
      });

      const updated = await repository.update(created.id, {
        title: 'Updated Title',
        messageCount: 10,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.messageCount).toBe(10);
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(created.updated_at.getTime());
    });

    it('should only update specified fields', async () => {
      const created = await repository.create({
        claudeConversationId: 'claude-partial',
        title: 'Original',
        messageCount: 5,
      });

      const updated = await repository.update(created.id, { title: 'New Title' });

      expect(updated.title).toBe('New Title');
      expect(updated.messageCount).toBe(5); // unchanged
    });
  });

  describe('delete', () => {
    it('should delete an existing conversation', async () => {
      const created = await repository.create({
        claudeConversationId: 'claude-delete',
      });

      await repository.delete(created.id);

      const found = await repository.findByClaudeId('claude-delete');
      expect(found).toBeNull();
    });

    it('should not throw when deleting non-existent conversation', async () => {
      await expect(
        repository.delete('00000000-0000-0000-0000-000000000000')
      ).resolves.not.toThrow();
    });
  });

  describe('findByDateRange', () => {
    it('should find conversations within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await repository.create({ claudeConversationId: 'claude-today' });

      const found = await repository.findByDateRange(yesterday, tomorrow);

      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(c => c.claudeConversationId === 'claude-today')).toBe(true);
    });

    it('should find conversations with only from date', async () => {
      const pastDate = new Date('2020-01-01');

      await repository.create({ claudeConversationId: 'claude-from-only' });

      const found = await repository.findByDateRange(pastDate, undefined);

      expect(found.length).toBeGreaterThanOrEqual(1);
    });

    it('should find conversations with only to date', async () => {
      const futureDate = new Date('2030-01-01');

      await repository.create({ claudeConversationId: 'claude-to-only' });

      const found = await repository.findByDateRange(undefined, futureDate);

      expect(found.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error when no date parameters provided', async () => {
      await expect(repository.findByDateRange(undefined, undefined)).rejects.toThrow();
    });
  });

  describe('findConversationWithoutEmbeddings', () => {
    it('should return conversations that have no embeddings', async () => {
      const conv1 = await repository.create({ claudeConversationId: 'claude-no-embed' });
      const conv2 = await repository.create({ claudeConversationId: 'claude-has-embed' });

      // Create embedding for conv2 only
      const fakeEmbedding = new Array(1024).fill(0.1);
      await embeddingsRepository.create({
        conversationId: conv2.id,
        embedding: fakeEmbedding,
      });

      const withoutEmbeddings = await repository.findConversationWithoutEmbeddings();

      expect(withoutEmbeddings).toContain(conv1.id);
      expect(withoutEmbeddings).not.toContain(conv2.id);
    });

    it('should return empty array when all conversations have embeddings', async () => {
      const conv = await repository.create({ claudeConversationId: 'claude-all-embedded' });

      const fakeEmbedding = new Array(1024).fill(0.1);
      await embeddingsRepository.create({
        conversationId: conv.id,
        embedding: fakeEmbedding,
      });

      const withoutEmbeddings = await repository.findConversationWithoutEmbeddings();

      expect(withoutEmbeddings).not.toContain(conv.id);
    });
  });
});
