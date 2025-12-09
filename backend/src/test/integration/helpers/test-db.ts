import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../../../infrastructure/db/schema";

const TEST_DATABASE_URL = "postgresql://postgres:testpass@localhost:5433/jarvis_test";

export type TestDatabase = PostgresJsDatabase<typeof schema>;

let pool: ReturnType<typeof postgres> | null = null;
let testDb: TestDatabase | null = null;
let isSetupComplete = false;

export async function getTestDb(): Promise<TestDatabase> {
  if (testDb) return testDb;

  pool = postgres(TEST_DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  testDb = drizzle(pool, { schema });
  return testDb;
}

export async function setupTestDatabase(): Promise<void> {
  if (isSetupComplete) return;

  const db = await getTestDb();

  // Enable pgvector extension (ignore error if already exists)
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  } catch {
    // Extension may already exist from parallel test run
  }

  // Create tables if they don't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claude_conversation_id VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Untitled Conversation',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      message_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL,
      sequence_number INTEGER NOT NULL,
      UNIQUE(conversation_id, sequence_number)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
      embedding vector(1024) NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON conversations(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_claude_id ON conversations(claude_conversation_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_sequence ON messages(conversation_id, sequence_number)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS conversation_embeddings_idx ON conversations_embeddings(conversation_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS embedding_idx ON conversations_embeddings USING hnsw (embedding vector_cosine_ops)`);

  isSetupComplete = true;
}

export async function truncateTables(): Promise<void> {
  const db = await getTestDb();

  // Truncate in order respecting foreign keys
  await db.execute(sql`TRUNCATE TABLE conversations_embeddings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE messages CASCADE`);
  await db.execute(sql`TRUNCATE TABLE conversations CASCADE`);
}

export async function closeTestDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    testDb = null;
  }
}
