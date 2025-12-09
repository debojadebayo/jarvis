import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { EmbeddingsRepository } from '../../../domain/repositories/embeddings.repository';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository';
import {
  getTestDb,
  setupTestDatabase,
  truncateTables,
  closeTestDatabase,
  TestDatabase
} from '../helpers/test-db';

describe('EmbeddingsRepository Integration Tests', () => {
  let db: TestDatabase;
  let repository: EmbeddingsRepository;
  let conversationRepository: ConversationRepository;

  // Helper to create a 1024-dimensional embedding with a specific pattern
  function createEmbedding(seed: number): number[] {
    const embedding = new Array(1024);
    for (let i = 0; i < 1024; i++) {
      embedding[i] = Math.sin(seed + i * 0.01) * 0.5;
    }
    return embedding;
  }

  // Helper to create a normalized embedding (for cosine similarity)
  function createNormalizedEmbedding(values: number[]): number[] {
    const embedding = new Array(1024).fill(0);
    values.forEach((v, i) => {
      if (i < 1024) embedding[i] = v;
    });
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / (magnitude || 1));
  }

  beforeAll(async () => {
    db = await getTestDb();
    await setupTestDatabase();
    repository = new EmbeddingsRepository(db);
    conversationRepository = new ConversationRepository(db);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  async function createTestConversation(claudeId: string) {
    return conversationRepository.create({ claudeConversationId: claudeId });
  }

  describe('create', () => {
    it('should create a new embedding', async () => {
      const conversation = await createTestConversation('conv-embed-1');
      const embedding = createEmbedding(1);

      const result = await repository.create({
        conversationId: conversation.id,
        embedding,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.conversationId).toBe(conversation.id);
      expect(result.embedding).toHaveLength(1024);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should fail when conversation does not exist', async () => {
      const embedding = createEmbedding(1);

      await expect(
        repository.create({
          conversationId: '00000000-0000-0000-0000-000000000000',
          embedding,
        })
      ).rejects.toThrow();
    });

    it('should fail when embedding has wrong dimensions', async () => {
      const conversation = await createTestConversation('conv-wrong-dim');
      const wrongEmbedding = new Array(512).fill(0.1); // Wrong size

      await expect(
        repository.create({
          conversationId: conversation.id,
          embedding: wrongEmbedding,
        })
      ).rejects.toThrow();
    });

    it('should fail on duplicate conversationId', async () => {
      const conversation = await createTestConversation('conv-dup-embed');
      const embedding = createEmbedding(1);

      await repository.create({ conversationId: conversation.id, embedding });

      await expect(
        repository.create({ conversationId: conversation.id, embedding })
      ).rejects.toThrow();
    });
  });

  describe('findByConversationId', () => {
    it('should find an existing embedding', async () => {
      const conversation = await createTestConversation('conv-find-embed');
      const embedding = createEmbedding(42);
      await repository.create({ conversationId: conversation.id, embedding });

      const found = await repository.findByConversationId(conversation.id);

      expect(found).not.toBeNull();
      expect(found!.conversationId).toBe(conversation.id);
      expect(found!.embedding).toHaveLength(1024);
    });

    it('should return null for non-existent embedding', async () => {
      const conversation = await createTestConversation('conv-no-embed');

      const found = await repository.findByConversationId(conversation.id);

      expect(found).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should insert new embedding when none exists', async () => {
      const conversation = await createTestConversation('conv-upsert-new');
      const embedding = createEmbedding(1);

      const result = await repository.upsert(conversation.id, embedding);

      expect(result).toBeDefined();
      expect(result.conversationId).toBe(conversation.id);
    });

    it('should update existing embedding on conflict', async () => {
      const conversation = await createTestConversation('conv-upsert-update');
      const embedding1 = createEmbedding(1);
      const embedding2 = createEmbedding(2);

      // Create initial embedding
      const initial = await repository.create({
        conversationId: conversation.id,
        embedding: embedding1,
      });

      // Upsert with new embedding
      const updated = await repository.upsert(conversation.id, embedding2);

      expect(updated.id).toBe(initial.id); // Same record
      expect(updated.embedding).not.toEqual(initial.embedding); // Different values
    });

    it('should update timestamp on upsert', async () => {
      const conversation = await createTestConversation('conv-upsert-time');
      const embedding = createEmbedding(1);

      const initial = await repository.create({
        conversationId: conversation.id,
        embedding,
      });

      // Wait a small amount to ensure timestamp differs
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await repository.upsert(conversation.id, createEmbedding(2));

      expect(updated.created_at.getTime()).toBeGreaterThanOrEqual(initial.created_at.getTime());
    });
  });

  describe('compareEmbeddings', () => {
    it('should return embeddings ordered by similarity', async () => {
      // Create test conversations with embeddings
      const conv1 = await createTestConversation('conv-similar-1');
      const conv2 = await createTestConversation('conv-similar-2');
      const conv3 = await createTestConversation('conv-similar-3');

      // Create embeddings with known similarity patterns
      // Embedding 1: mostly positive values in first dimensions
      const embed1 = createNormalizedEmbedding([1, 1, 1, 0, 0]);
      // Embedding 2: similar to query (will be most similar)
      const embed2 = createNormalizedEmbedding([1, 0.9, 0.9, 0, 0]);
      // Embedding 3: different (orthogonal-ish)
      const embed3 = createNormalizedEmbedding([0, 0, 0, 1, 1]);

      await repository.create({ conversationId: conv1.id, embedding: embed1 });
      await repository.create({ conversationId: conv2.id, embedding: embed2 });
      await repository.create({ conversationId: conv3.id, embedding: embed3 });

      // Query similar to embed1 and embed2
      const queryEmbedding = createNormalizedEmbedding([1, 1, 1, 0, 0]);

      const results = await repository.compareEmbeddings(queryEmbedding);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // First result should be the most similar (embed1 or embed2)
      const firstResultConvId = results[0].conversationId;
      expect([conv1.id, conv2.id]).toContain(firstResultConvId);
    });

    it('should return at most 5 results', async () => {
      // Create 7 conversations with embeddings
      for (let i = 0; i < 7; i++) {
        const conv = await createTestConversation(`conv-limit-${i}`);
        await repository.create({
          conversationId: conv.id,
          embedding: createEmbedding(i),
        });
      }

      const queryEmbedding = createEmbedding(0);
      const results = await repository.compareEmbeddings(queryEmbedding);

      expect(results).toHaveLength(5);
    });

    it('should throw error when no embeddings exist', async () => {
      const queryEmbedding = createEmbedding(1);

      await expect(repository.compareEmbeddings(queryEmbedding)).rejects.toThrow();
    });
  });

  describe('cascade delete', () => {
    it('should delete embeddings when conversation is deleted', async () => {
      const conversation = await createTestConversation('conv-cascade-embed');
      await repository.create({
        conversationId: conversation.id,
        embedding: createEmbedding(1),
      });

      // Verify embedding exists
      let found = await repository.findByConversationId(conversation.id);
      expect(found).not.toBeNull();

      // Delete conversation
      await conversationRepository.delete(conversation.id);

      // Embedding should be gone
      found = await repository.findByConversationId(conversation.id);
      expect(found).toBeNull();
    });
  });
});
