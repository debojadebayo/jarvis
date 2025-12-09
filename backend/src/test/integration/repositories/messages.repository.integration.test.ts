import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MessageRepository } from '../../../domain/repositories/messages.repository';
import { ConversationRepository } from '../../../domain/repositories/conversation.repository';
import {
  getTestDb,
  setupTestDatabase,
  truncateTables,
  closeTestDatabase,
  TestDatabase
} from '../helpers/test-db';

describe('MessageRepository Integration Tests', () => {
  let db: TestDatabase;
  let repository: MessageRepository;
  let conversationRepository: ConversationRepository;

  beforeAll(async () => {
    db = await getTestDb();
    await setupTestDatabase();
    repository = new MessageRepository(db);
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

  describe('upsertMessages', () => {
    it('should insert new messages', async () => {
      const conversation = await createTestConversation('conv-1');

      await repository.upsertMessages([
        {
          conversationId: conversation.id,
          role: 'user',
          content: 'Hello!',
          created_at: new Date(),
          sequence_number: 1,
        },
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Hi there!',
          created_at: new Date(),
          sequence_number: 2,
        },
      ]);

      const messages = await repository.findByConversationId(conversation.id);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello!');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Hi there!');
    });

    it('should update existing messages on conflict', async () => {
      const conversation = await createTestConversation('conv-upsert');

      // Insert initial message
      await repository.upsertMessages([
        {
          conversationId: conversation.id,
          role: 'user',
          content: 'Original content',
          created_at: new Date(),
          sequence_number: 1,
        },
      ]);

      // Upsert with updated content
      await repository.upsertMessages([
        {
          conversationId: conversation.id,
          role: 'user',
          content: 'Updated content',
          created_at: new Date(),
          sequence_number: 1,
        },
      ]);

      const messages = await repository.findByConversationId(conversation.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Updated content');
    });

    it('should handle empty array gracefully', async () => {
      await expect(repository.upsertMessages([])).resolves.not.toThrow();
    });

    it('should fail when conversation does not exist', async () => {
      await expect(
        repository.upsertMessages([
          {
            conversationId: '00000000-0000-0000-0000-000000000000',
            role: 'user',
            content: 'Test',
            created_at: new Date(),
            sequence_number: 1,
          },
        ])
      ).rejects.toThrow();
    });
  });

  describe('findByConversationId', () => {
    it('should return messages ordered by sequence number', async () => {
      const conversation = await createTestConversation('conv-ordered');

      // Insert in reverse order
      await repository.upsertMessages([
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Third',
          created_at: new Date(),
          sequence_number: 3,
        },
        {
          conversationId: conversation.id,
          role: 'user',
          content: 'First',
          created_at: new Date(),
          sequence_number: 1,
        },
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Second',
          created_at: new Date(),
          sequence_number: 2,
        },
      ]);

      const messages = await repository.findByConversationId(conversation.id);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should return empty array for conversation with no messages', async () => {
      const conversation = await createTestConversation('conv-empty');

      const messages = await repository.findByConversationId(conversation.id);

      expect(messages).toHaveLength(0);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await repository.findByConversationId(
        '00000000-0000-0000-0000-000000000000'
      );

      expect(messages).toHaveLength(0);
    });
  });

  describe('findByConversationIds', () => {
    it('should return messages from multiple conversations', async () => {
      const conv1 = await createTestConversation('conv-multi-1');
      const conv2 = await createTestConversation('conv-multi-2');

      await repository.upsertMessages([
        {
          conversationId: conv1.id,
          role: 'user',
          content: 'Message from conv1',
          created_at: new Date(),
          sequence_number: 1,
        },
        {
          conversationId: conv2.id,
          role: 'user',
          content: 'Message from conv2',
          created_at: new Date(),
          sequence_number: 1,
        },
      ]);

      const messages = await repository.findByConversationIds([conv1.id, conv2.id]);

      expect(messages).toHaveLength(2);
      const contents = messages.map(m => m.content);
      expect(contents).toContain('Message from conv1');
      expect(contents).toContain('Message from conv2');
    });

    it('should return messages ordered by sequence number across conversations', async () => {
      const conv1 = await createTestConversation('conv-order-1');
      const conv2 = await createTestConversation('conv-order-2');

      await repository.upsertMessages([
        {
          conversationId: conv1.id,
          role: 'user',
          content: 'Conv1 - Seq2',
          created_at: new Date(),
          sequence_number: 2,
        },
        {
          conversationId: conv1.id,
          role: 'user',
          content: 'Conv1 - Seq1',
          created_at: new Date(),
          sequence_number: 1,
        },
        {
          conversationId: conv2.id,
          role: 'user',
          content: 'Conv2 - Seq1',
          created_at: new Date(),
          sequence_number: 1,
        },
      ]);

      const messages = await repository.findByConversationIds([conv1.id, conv2.id]);

      // Messages should be ordered by sequence_number
      expect(messages[0].sequence_number).toBeLessThanOrEqual(messages[1].sequence_number);
    });

    it('should return empty array for empty input', async () => {
      const messages = await repository.findByConversationIds([]);

      expect(messages).toHaveLength(0);
    });
  });

  describe('cascade delete', () => {
    it('should delete messages when conversation is deleted', async () => {
      const conversation = await createTestConversation('conv-cascade');

      await repository.upsertMessages([
        {
          conversationId: conversation.id,
          role: 'user',
          content: 'Will be deleted',
          created_at: new Date(),
          sequence_number: 1,
        },
      ]);

      // Delete the conversation
      await conversationRepository.delete(conversation.id);

      // Messages should be gone
      const messages = await repository.findByConversationId(conversation.id);
      expect(messages).toHaveLength(0);
    });
  });
});
