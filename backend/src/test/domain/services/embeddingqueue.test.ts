/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingQueue } from '../../../domain/services/embeddingqueue';

describe('EmbeddingQueue', () => {
  let queue: EmbeddingQueue;

  beforeEach(() => {
    // Get the singleton instance
    queue = EmbeddingQueue.getInstance();

    // Drain the queue to ensure clean state for each test
    while (!queue.isEmpty()) {
      queue.processNext();
    }
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = EmbeddingQueue.getInstance();
      const instance2 = EmbeddingQueue.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('add', () => {
    it('should add a conversation ID to the queue', () => {
      expect(queue.isEmpty()).toBe(true);

      queue.add('conv-123');

      expect(queue.isEmpty()).toBe(false);
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should add multiple conversation IDs in order', () => {
      queue.add('conv-1');
      queue.add('conv-2');
      queue.add('conv-3');

      expect(queue.getQueueLength()).toBe(3);

      // Verify FIFO order
      expect(queue.processNext()).toBe('conv-1');
      expect(queue.processNext()).toBe('conv-2');
      expect(queue.processNext()).toBe('conv-3');
    });

    it('should allow duplicate conversation IDs', () => {
      queue.add('conv-1');
      queue.add('conv-1');

      expect(queue.getQueueLength()).toBe(2);
    });
  });

  describe('processNext', () => {
    it('should return undefined when queue is empty', () => {
      expect(queue.isEmpty()).toBe(true);

      const result = queue.processNext();

      expect(result).toBeUndefined();
    });

    it('should return and remove the first item from queue', () => {
      queue.add('conv-1');
      queue.add('conv-2');

      const result = queue.processNext();

      expect(result).toBe('conv-1');
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should process items in FIFO order', () => {
      queue.add('first');
      queue.add('second');
      queue.add('third');

      expect(queue.processNext()).toBe('first');
      expect(queue.processNext()).toBe('second');
      expect(queue.processNext()).toBe('third');
      expect(queue.processNext()).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('should return true when queue has no items', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when queue has items', () => {
      queue.add('conv-1');

      expect(queue.isEmpty()).toBe(false);
    });

    it('should return true after all items are processed', () => {
      queue.add('conv-1');
      queue.processNext();

      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('getQueueLength', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should return correct count after adding items', () => {
      queue.add('conv-1');
      expect(queue.getQueueLength()).toBe(1);

      queue.add('conv-2');
      expect(queue.getQueueLength()).toBe(2);

      queue.add('conv-3');
      expect(queue.getQueueLength()).toBe(3);
    });

    it('should decrease after processing items', () => {
      queue.add('conv-1');
      queue.add('conv-2');
      expect(queue.getQueueLength()).toBe(2);

      queue.processNext();
      expect(queue.getQueueLength()).toBe(1);

      queue.processNext();
      expect(queue.getQueueLength()).toBe(0);
    });
  });

  describe('queue behavior', () => {
    it('should handle interleaved add and process operations', () => {
      queue.add('conv-1');
      expect(queue.processNext()).toBe('conv-1');

      queue.add('conv-2');
      queue.add('conv-3');
      expect(queue.processNext()).toBe('conv-2');

      queue.add('conv-4');
      expect(queue.getQueueLength()).toBe(2);
      expect(queue.processNext()).toBe('conv-3');
      expect(queue.processNext()).toBe('conv-4');
    });
  });
});
