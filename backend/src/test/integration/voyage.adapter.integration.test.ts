/// <reference types="vitest/globals" />

import { describe, it, expect, beforeAll } from 'vitest';
import { VoyageAdapter } from '../../infrastructure/embedding-providers/voyage.adapter';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test for real API key (override setup.ts mock values)
config({ path: resolve(__dirname, '../../../.env.test'), override: true });

describe('VoyageAdapter Integration Tests', () => {
  let adapter: VoyageAdapter;
  const apiKey = process.env.VOYAGE_API_KEY;

  beforeAll(() => {
    if (!apiKey || apiKey === 'test-voyage-key') {
      throw new Error('Real VOYAGE_API_KEY required for integration tests. Check .env.test');
    }
    adapter = new VoyageAdapter(apiKey);
  });

  describe('embed', () => {
    it('should generate embeddings for a simple text', async () => {
      const text = 'Hello, world!';

      const result = await adapter.embed(text);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // voyage-3-large produces 1024-dimensional embeddings
      expect(result.length).toBe(1024);
      // Embeddings should be numbers
      expect(typeof result[0]).toBe('number');
    });

    it('should generate embeddings for a longer conversation text', async () => {
      const text = `user: How do I use TypeScript generics?
assistant: TypeScript generics allow you to write reusable code that works with multiple types. Here's an example:
function identity<T>(arg: T): T {
  return arg;
}`;

      const result = await adapter.embed(text);

      expect(result).toBeDefined();
      expect(result.length).toBe(1024);
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'TypeScript programming language';
      const text2 = 'Cooking Italian pasta recipes';

      const [embedding1, embedding2] = await Promise.all([
        adapter.embed(text1),
        adapter.embed(text2),
      ]);

      expect(embedding1).not.toEqual(embedding2);

      // Calculate cosine similarity - should be low for unrelated texts
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);

      // Unrelated texts should have lower similarity (typically < 0.5)
      expect(similarity).toBeLessThan(0.7);
    });

    it('should generate similar embeddings for semantically related texts', async () => {
      const text1 = 'How do I write unit tests in JavaScript?';
      const text2 = 'What is the best way to test my JS code?';

      const [embedding1, embedding2] = await Promise.all([
        adapter.embed(text1),
        adapter.embed(text2),
      ]);

      // Calculate cosine similarity
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);

      // Related texts should have higher similarity (typically > 0.7)
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should reject empty strings', async () => {
      const text = '';

      await expect(adapter.embed(text)).rejects.toThrow();
    });

    it('should handle special characters and unicode', async () => {
      const text = 'Hello! 你好 Special chars: @#$%^&*()';

      const result = await adapter.embed(text);

      expect(result).toBeDefined();
      expect(result.length).toBe(1024);
    });
  });

  describe('error handling', () => {
    it('should throw error with invalid API key', async () => {
      const invalidAdapter = new VoyageAdapter('invalid-api-key');

      await expect(invalidAdapter.embed('test')).rejects.toThrow();
    });
  });
});
