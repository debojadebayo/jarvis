/// <reference types="vitest/globals" />
import { vi, beforeEach } from 'vitest';

/* Set test environment variables before any module imports
For unit testing. we will actually need an .env.test for integration testing
*/
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.API_KEY ='test-api-key-min-16-chars';
process.env.VOYAGE_API_KEY ='test-voyage-key';
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.HOST = '0.0.0.0';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
