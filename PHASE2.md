# Phase 2: Backend Storage

## Overview
Build the Fastify + TypeScript backend that receives conversations from the Chrome extension, stores them in PostgreSQL with pgvector, and generates embeddings for semantic search.

## Goals
1. Set up Fastify + TypeScript project structure
2. Configure PostgreSQL with pgvector extension
3. Implement database schema with Drizzle ORM
4. Create POST /conversations endpoint
5. Implement embedding generation with Voyage AI
6. Add upsert logic for multi-day conversations
7. Implement proper middleware stack (logging, auth, validation, error handling)
8. Add rate limiting for API protection

---

## 1. Project Structure

```
/backend
├── src/
│   ├── index.ts                 # Application entry point
│   ├── app.ts                   # Fastify app configuration
│   ├── config/
│   │   └── env.ts               # Environment variable validation
│   ├── routes/
│   │   ├── index.ts             # Route registration
│   │   ├── conversations.ts     # Conversation routes
│   │   └── health.ts            # Health check routes
│   ├── controllers/
│   │   ├── conversation.controller.ts
│   │   └── health.controller.ts
│   ├── repositories/
│   │   ├── conversation.repository.ts
│   │   ├── message.repository.ts
│   │   └── embedding.repository.ts
│   ├── services/
│   │   ├── conversation.service.ts
│   │   ├── embedding.service.ts
│   │   └── embedding-queue.ts
│   ├── adapters/
│   │   └── voyage.adapter.ts    # Voyage AI embedding adapter
│   ├── db/
│   │   ├── index.ts             # Database connection pool
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   └── migrations/          # SQL migrations
│   ├── middleware/
│   │   ├── index.ts             # Middleware registration (order matters!)
│   │   ├── logger.ts            # Request logging
│   │   ├── auth.ts              # API key authentication
│   │   ├── rate-limit.ts        # Rate limiting
│   │   └── validate.ts          # Request validation
│   ├── errors/
│   │   ├── index.ts             # Error class exports
│   │   ├── base.error.ts        # Base error class
│   │   ├── not-found.error.ts
│   │   ├── validation.error.ts
│   │   ├── auth.error.ts
│   │   └── database.error.ts
│   ├── schemas/
│   │   ├── conversation.schema.ts  # Zod validation schemas
│   │   └── common.schema.ts
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   └── middleware/
│   └── integration/
│       ├── conversations.test.ts
│       └── health.test.ts
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── vitest.config.ts
├── Dockerfile
└── .env.example
```

---

## 2. Middleware Stack

### Execution Order (Critical!)

```
Request → Logger → Rate Limit → Auth → Validation → Controller → Response
                                                          ↓
                                              Global Error Handler
```

**Registration order in app.ts:**
1. Logger (FIRST - logs all requests)
2. CORS
3. Rate Limiting
4. Routes (with auth + validation per route)
5. Global Error Handler (LAST - catches all errors)

### 2.1 Logger Middleware

```typescript
// src/middleware/logger.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function loggerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now();

  // Log after response is sent
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    if (reply.statusCode >= 400) {
      request.log.error(logData);
    } else {
      request.log.info(logData);
    }
  });
}
```

### 2.2 Rate Limiting Middleware

```typescript
// src/middleware/rate-limit.ts
import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,              // 100 requests
    timeWindow: '15 minutes',
    errorResponseBuilder: (request, context) => ({
      error: 'TooManyRequests',
      message: `Rate limit exceeded. Try again in ${context.after}`,
      statusCode: 429,
    }),
  });
}
```

### 2.3 Authentication Middleware

```typescript
// src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationError } from '../errors';
import { env } from '../config/env';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  if (token !== env.API_KEY) {
    throw new AuthenticationError('Invalid API key');
  }

  // Attach auth info to request for downstream use
  request.authenticated = true;
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    authenticated?: boolean;
  }
}
```

### 2.4 Validation Middleware

```typescript
// src/middleware/validate.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export function validate<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = schema.parse(request.body);
      request.body = validated;
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError('Request validation failed', details);
      }
      throw error;
    }
  };
}
```

---

## 3. Custom Error Classes

```typescript
// src/errors/base.error.ts
export abstract class AppError extends Error {
  abstract statusCode: number;
  abstract code: string;

  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

// src/errors/validation.error.ts
export class ValidationError extends AppError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
}

// src/errors/auth.error.ts
export class AuthenticationError extends AppError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
}

export class AuthorizationError extends AppError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
}

// src/errors/not-found.error.ts
export class NotFoundError extends AppError {
  statusCode = 404;
  code = 'NOT_FOUND';
}

// src/errors/database.error.ts
export class DatabaseError extends AppError {
  statusCode = 500;
  code = 'DATABASE_ERROR';
}
```

### Global Error Handler

```typescript
// src/middleware/error-handler.ts
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors';

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error with full stack trace
  request.log.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: request.method,
      url: request.url,
      body: request.body,
    },
  });

  // Handle known application errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.validation,
      statusCode: 400,
    });
  }

  // Handle unknown errors (don't leak internal details)
  return reply.status(500).send({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}
```

---

## 4. Validation Schemas (Zod)

```typescript
// src/schemas/conversation.schema.ts
import { z } from 'zod';

export const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty'),
  timestamp: z.string().datetime({ message: 'Invalid timestamp format' }),
});

export const conversationSchema = z.object({
  id: z.string().min(1, 'Conversation ID is required'),
  title: z.string().nullable(),
  created_at: z.string().datetime({ message: 'Invalid created_at format' }),
  messages: z.array(messageSchema).min(1, 'At least one message is required'),
});

export const ingestRequestSchema = z.object({
  conversations: z
    .array(conversationSchema)
    .min(1, 'At least one conversation is required')
    .max(100, 'Maximum 100 conversations per request'),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type ConversationInput = z.infer<typeof conversationSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
```

---

## 5. Controller Layer

```typescript
// src/controllers/conversation.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConversationService } from '../services/conversation.service';
import { IngestRequest } from '../schemas/conversation.schema';

export class ConversationController {
  constructor(private conversationService: ConversationService) {}

  async ingest(
    request: FastifyRequest<{ Body: IngestRequest }>,
    reply: FastifyReply
  ) {
    const result = await this.conversationService.upsertConversations(
      request.body.conversations
    );

    return reply.status(200).send({
      success: true,
      processed: result.processed,
      created: result.created,
      updated: result.updated,
    });
  }
}

// src/controllers/health.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export class HealthController {
  async check(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  async checkWithDb(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Test database connection
      await db.execute(sql`SELECT 1`);

      return reply.status(200).send({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

---

## 6. Routes with Middleware

```typescript
// src/routes/conversations.ts
import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ingestRequestSchema } from '../schemas/conversation.schema';
import { ConversationController } from '../controllers/conversation.controller';
import { ConversationService } from '../services/conversation.service';

export async function conversationRoutes(app: FastifyInstance) {
  const controller = new ConversationController(new ConversationService());

  app.post(
    '/api/v1/conversations',
    {
      preHandler: [
        authenticate,
        validate(ingestRequestSchema),
      ],
    },
    controller.ingest.bind(controller)
  );
}

// src/routes/health.ts
import { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers/health.controller';

export async function healthRoutes(app: FastifyInstance) {
  const controller = new HealthController();

  // Basic health check (no auth required)
  app.get('/health', controller.check.bind(controller));

  // Detailed health check with DB status
  app.get('/health/db', controller.checkWithDb.bind(controller));
}

// src/routes/index.ts
import { FastifyInstance } from 'fastify';
import { conversationRoutes } from './conversations';
import { healthRoutes } from './health';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(conversationRoutes);
}
```

---

## 7. Database Layer

### Connection Pool

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

// Connection pool configuration
const pool = postgres(env.DATABASE_URL, {
  max: 10,                    // Maximum connections
  idle_timeout: 20,           // Close idle connections after 20s
  connect_timeout: 10,        // Connection timeout 10s
});

export const db = drizzle(pool, { schema });

// Test connection on startup
export async function testConnection(): Promise<boolean> {
  try {
    await pool`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await pool.end();
}
```

### Schema

```typescript
// src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, integer, index, unique } from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  claudeConversationId: varchar('claude_conversation_id', { length: 255 }).unique().notNull(),
  title: text('title'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  messageCount: integer('message_count').default(0),
}, (table) => ({
  createdAtIdx: index('idx_conversations_created_at').on(table.createdAt),
  claudeIdIdx: index('idx_conversations_claude_id').on(table.claudeConversationId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp'),
  sequenceNumber: integer('sequence_number').notNull(),
}, (table) => ({
  conversationIdx: index('idx_messages_conversation_id').on(table.conversationId),
  sequenceIdx: index('idx_messages_sequence').on(table.conversationId, table.sequenceNumber),
  uniqueSequence: unique().on(table.conversationId, table.sequenceNumber),
}));

export const conversationEmbeddings = pgTable('conversation_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).unique(),
  embedding: vector('embedding', { dimensions: 1024 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### SQL Migration

```sql
-- migrations/0001_initial.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claude_conversation_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    message_count INTEGER DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP,
    sequence_number INTEGER NOT NULL,
    UNIQUE(conversation_id, sequence_number)
);

-- Conversation embeddings (conversation-level, not message-level)
CREATE TABLE conversation_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
    embedding vector(1024),  -- Voyage AI dimension
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_claude_id ON conversations(claude_conversation_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sequence ON messages(conversation_id, sequence_number);

-- Vector index (adjust lists based on dataset size)
CREATE INDEX idx_conversation_embeddings_vector
ON conversation_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## 8. Repository Layer

```typescript
// src/repositories/conversation.repository.ts
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { conversations, messages } from '../db/schema';
import { DatabaseError } from '../errors';

export class ConversationRepository {
  async findByClaudeId(claudeId: string) {
    try {
      const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.claudeConversationId, claudeId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to find conversation', { claudeId, error });
    }
  }

  async create(data: {
    claudeConversationId: string;
    title: string | null;
    createdAt: Date;
    messageCount: number;
  }) {
    try {
      const result = await db
        .insert(conversations)
        .values(data)
        .returning();

      return result[0];
    } catch (error) {
      throw new DatabaseError('Failed to create conversation', { data, error });
    }
  }

  async update(id: string, data: Partial<{
    title: string | null;
    messageCount: number;
    updatedAt: Date;
  }>) {
    try {
      const result = await db
        .update(conversations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();

      return result[0];
    } catch (error) {
      throw new DatabaseError('Failed to update conversation', { id, data, error });
    }
  }
}

// src/repositories/message.repository.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { messages } from '../db/schema';
import { DatabaseError } from '../errors';

export class MessageRepository {
  // Use parameterized queries - NEVER concatenate user input
  async upsertMessages(
    conversationId: string,
    messageData: Array<{
      role: string;
      content: string;
      timestamp: Date | null;
      sequenceNumber: number;
    }>
  ) {
    try {
      for (const msg of messageData) {
        await db
          .insert(messages)
          .values({
            conversationId,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            sequenceNumber: msg.sequenceNumber,
          })
          .onConflictDoUpdate({
            target: [messages.conversationId, messages.sequenceNumber],
            set: {
              content: msg.content,
              timestamp: msg.timestamp,
            },
          });
      }
    } catch (error) {
      throw new DatabaseError('Failed to upsert messages', { conversationId, error });
    }
  }

  async findByConversationId(conversationId: string) {
    try {
      return await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.sequenceNumber);
    } catch (error) {
      throw new DatabaseError('Failed to find messages', { conversationId, error });
    }
  }
}
```

---

## 9. Service Layer

```typescript
// src/services/conversation.service.ts
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { EmbeddingQueue } from './embedding-queue';
import { ConversationInput } from '../schemas/conversation.schema';

interface UpsertResult {
  processed: number;
  created: number;
  updated: number;
}

export class ConversationService {
  private conversationRepo = new ConversationRepository();
  private messageRepo = new MessageRepository();
  private embeddingQueue = EmbeddingQueue.getInstance();

  async upsertConversations(conversations: ConversationInput[]): Promise<UpsertResult> {
    let created = 0;
    let updated = 0;

    for (const conv of conversations) {
      const existing = await this.conversationRepo.findByClaudeId(conv.id);

      if (!existing) {
        // Create new conversation
        const newConv = await this.conversationRepo.create({
          claudeConversationId: conv.id,
          title: conv.title,
          createdAt: new Date(conv.created_at),
          messageCount: conv.messages.length,
        });

        // Insert messages with sequence numbers
        const messageData = conv.messages.map((msg, index) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : null,
          sequenceNumber: index,
        }));

        await this.messageRepo.upsertMessages(newConv.id, messageData);

        // Queue embedding generation
        this.embeddingQueue.add(newConv.id);

        created++;
      } else if (existing.messageCount !== conv.messages.length) {
        // Update existing conversation (new messages added)
        await this.conversationRepo.update(existing.id, {
          title: conv.title,
          messageCount: conv.messages.length,
        });

        const messageData = conv.messages.map((msg, index) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : null,
          sequenceNumber: index,
        }));

        await this.messageRepo.upsertMessages(existing.id, messageData);

        // Regenerate embedding (conversation changed)
        this.embeddingQueue.add(existing.id);

        updated++;
      }
      // else: no changes, skip
    }

    return {
      processed: conversations.length,
      created,
      updated,
    };
  }
}
```

---

## 10. Embedding Service & Adapter

```typescript
// src/adapters/voyage.adapter.ts
import { env } from '../config/env';

export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class VoyageAdapter implements EmbeddingAdapter {
  private model = 'voyage-2';

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }
}

// src/services/embedding.service.ts
import { db } from '../db';
import { conversations, messages, conversationEmbeddings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { VoyageAdapter, EmbeddingAdapter } from '../adapters/voyage.adapter';

export class EmbeddingService {
  private adapter: EmbeddingAdapter;

  constructor(adapter?: EmbeddingAdapter) {
    this.adapter = adapter || new VoyageAdapter();
  }

  async generateEmbedding(conversationId: string): Promise<void> {
    // Fetch conversation with messages
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv[0]) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.sequenceNumber);

    // Build embedding input
    const input = this.buildEmbeddingInput(conv[0].title, msgs);

    // Generate embedding
    const embedding = await this.adapter.embed(input);

    // Store embedding (upsert)
    await db
      .insert(conversationEmbeddings)
      .values({
        conversationId,
        embedding,
      })
      .onConflictDoUpdate({
        target: conversationEmbeddings.conversationId,
        set: {
          embedding,
          updatedAt: new Date(),
        },
      });
  }

  private buildEmbeddingInput(
    title: string | null,
    msgs: Array<{ role: string; content: string }>
  ): string {
    const parts: string[] = [];

    if (title) {
      parts.push(`Title: ${title}`);
      parts.push('');
    }

    for (const msg of msgs) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      parts.push(`${role}: ${msg.content}`);
    }

    return parts.join('\n');
  }
}

// src/services/embedding-queue.ts
import { EmbeddingService } from './embedding.service';

export class EmbeddingQueue {
  private static instance: EmbeddingQueue;
  private queue: string[] = [];
  private processing = false;
  private embeddingService = new EmbeddingService();

  static getInstance(): EmbeddingQueue {
    if (!EmbeddingQueue.instance) {
      EmbeddingQueue.instance = new EmbeddingQueue();
    }
    return EmbeddingQueue.instance;
  }

  add(conversationId: string) {
    this.queue.push(conversationId);
    this.process();
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const id = this.queue.shift()!;
      try {
        await this.embeddingService.generateEmbedding(id);
        console.log(`Generated embedding for conversation: ${id}`);
      } catch (error) {
        console.error(`Failed to generate embedding for ${id}:`, error);
        // Could re-queue with backoff for V2
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
```

---

## 11. Application Setup

```typescript
// src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRateLimit } from './middleware/rate-limit';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
import { loggerMiddleware } from './middleware/logger';
import { env } from './config/env';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // 1. Logger middleware (FIRST)
  app.addHook('onRequest', loggerMiddleware);

  // 2. CORS
  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? ['chrome-extension://*']
      : true,
    credentials: true,
  });

  // 3. Rate limiting
  await registerRateLimit(app);

  // 4. Routes (includes auth + validation per route)
  await registerRoutes(app);

  // 5. Global error handler (LAST)
  app.setErrorHandler(errorHandler);

  return app;
}

// src/index.ts
import { buildApp } from './app';
import { testConnection, closeConnection } from './db';
import { env } from './config/env';

async function main() {
  const app = await buildApp();

  // Test database connection before accepting requests
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await closeConnection();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`Server running at http://${env.HOST}:${env.PORT}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

---

## 12. Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/conversations

# Authentication
API_KEY=your-secret-api-key-min-16-chars

# Embedding Provider
VOYAGE_API_KEY=your-voyage-api-key

# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
```

---

## 13. Dependencies

```json
{
  "name": "jarvis-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "fastify": "^4.x",
    "@fastify/cors": "^8.x",
    "@fastify/rate-limit": "^9.x",
    "drizzle-orm": "^0.29.x",
    "postgres": "^3.x",
    "pgvector": "^0.1.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "drizzle-kit": "^0.20.x",
    "@types/node": "^20.x",
    "vitest": "^1.x",
    "@vitest/coverage-v8": "^1.x",
    "supertest": "^6.x",
    "@types/supertest": "^6.x"
  }
}
```

---

## 14. Docker Setup

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --production

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: conversations
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/conversations
      API_KEY: dev-secret-key-for-testing
      VOYAGE_API_KEY: ${VOYAGE_API_KEY}
      NODE_ENV: development
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  pgdata:
```

---

## 15. Testing

### Unit Tests

```typescript
// tests/unit/middleware/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../../../src/middleware/auth';
import { AuthenticationError } from '../../../src/errors';

describe('authenticate middleware', () => {
  it('throws error when authorization header is missing', async () => {
    const request = { headers: {} } as any;
    const reply = {} as any;

    await expect(authenticate(request, reply))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws error when token is invalid', async () => {
    const request = {
      headers: { authorization: 'Bearer wrong-key' },
    } as any;
    const reply = {} as any;

    await expect(authenticate(request, reply))
      .rejects.toThrow(AuthenticationError);
  });

  it('passes when token is valid', async () => {
    vi.stubEnv('API_KEY', 'valid-test-key');

    const request = {
      headers: { authorization: 'Bearer valid-test-key' },
    } as any;
    const reply = {} as any;

    await expect(authenticate(request, reply)).resolves.toBeUndefined();
    expect(request.authenticated).toBe(true);
  });
});

// tests/unit/services/conversation.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationService } from '../../../src/services/conversation.service';

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
  });

  it('creates new conversation when it does not exist', async () => {
    // Mock repository methods
    // Test upsert logic
  });

  it('updates existing conversation when messages change', async () => {
    // Test update logic
  });

  it('skips unchanged conversations', async () => {
    // Test skip logic
  });
});
```

### Integration Tests

```typescript
// tests/integration/conversations.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app';
import type { FastifyInstance } from 'fastify';

describe('POST /api/v1/conversations', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without auth header', async () => {
    const response = await request(app.server)
      .post('/api/v1/conversations')
      .send({ conversations: [] });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('AUTHENTICATION_ERROR');
  });

  it('returns 400 with invalid request body', async () => {
    const response = await request(app.server)
      .post('/api/v1/conversations')
      .set('Authorization', 'Bearer valid-test-key')
      .send({ conversations: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with valid request', async () => {
    const response = await request(app.server)
      .post('/api/v1/conversations')
      .set('Authorization', 'Bearer valid-test-key')
      .send({
        conversations: [
          {
            id: 'test-conv-123',
            title: 'Test Conversation',
            created_at: '2025-12-04T10:00:00Z',
            messages: [
              {
                role: 'user',
                content: 'Hello',
                timestamp: '2025-12-04T10:00:00Z',
              },
              {
                role: 'assistant',
                content: 'Hi there!',
                timestamp: '2025-12-04T10:00:05Z',
              },
            ],
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.processed).toBe(1);
  });
});

// tests/integration/health.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app';
import type { FastifyInstance } from 'fastify';

describe('Health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200', async () => {
    const response = await request(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /health/db returns database status', async () => {
    const response = await request(app.server).get('/health/db');

    expect(response.status).toBe(200);
    expect(response.body.database).toBeDefined();
  });
});
```

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/db/migrations/**'],
    },
    setupFiles: ['tests/setup.ts'],
  },
});
```

---

## 16. Implementation Checklist

### Setup
- [x] Initialize Node.js project with TypeScript
- [x] Configure ESM modules
- [x] Set up environment validation with Zod

### Middleware Stack
- [x] Implement logger middleware (timestamp, method, path, status, duration)
- [x] Configure CORS for Chrome extension
- [x] Implement rate limiting (100 req/15 min)
- [x] Implement authentication middleware
- [ ] Implement validation middleware with Zod schemas
- [ ] Implement global error handler

### Error Handling
- [ ] Create base AppError class
- [ ] Create ValidationError, AuthenticationError, NotFoundError, DatabaseError
- [ ] Wire up error handler (registered LAST)

### Database
- [ ] Set up Drizzle ORM with PostgreSQL
- [ ] Configure connection pool (min/max connections, timeouts)
- [ ] Create database migrations
- [ ] Test connection on startup

### Repositories
- [ ] Implement ConversationRepository with parameterized queries
- [ ] Implement MessageRepository with upsert logic
- [ ] Implement EmbeddingRepository

### Services
- [ ] Build ConversationService with upsert logic
- [ ] Build EmbeddingService with text concatenation
- [ ] Create simple embedding queue

### Adapters
- [ ] Create Voyage AI adapter with error handling

### Controllers
- [ ] Create ConversationController
- [ ] Create HealthController

### Routes
- [ ] POST /api/v1/conversations (auth + validation)
- [ ] GET /health (basic)
- [ ] GET /health/db (with database check)

### Testing
- [ ] Write unit tests for middleware
- [ ] Write unit tests for services
- [ ] Write integration tests for endpoints
- [ ] Set up test database

### Docker
- [ ] Create Dockerfile with multi-stage build
- [ ] Update docker-compose.yml for backend service

### Documentation
- [ ] Document API endpoints in README
- [ ] Include example requests/responses
- [ ] Document error codes and meanings

---

## 17. API Response Format Standards

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-04T10:00:00Z"
  }
}
```

### Error Response
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "conversations[0].id", "message": "Required" }
  ],
  "statusCode": 400
}
```

### HTTP Status Code Reference
| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET/POST/PUT |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Valid auth, no permission |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected errors |
| 503 | Service Unavailable | DB down, etc. |

---

## Next Steps After Phase 2

Phase 3 will add:
- GET /api/v1/search endpoint (semantic + keyword search)
- GET /api/v1/conversations/:id endpoint
- Vector similarity queries with pgvector
- Pagination for search results
