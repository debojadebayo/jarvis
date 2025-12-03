# Claude Conversation Indexer

## Overview
A system to capture, index, and make all your Claude.ai conversations searchable and reviewable. The indexed data is exposed to Claude so you can chat with an AI that has full context of everything you've learned.

## Problem Statement
- Most learning happens through conversations with Claude.ai over months
- No way to search across all historical conversations
- Knowledge fades without review
- Want Claude to help me review what I learned, with full context of past conversations

## Vision

### V1 (MVP) - Core Memory System
**Goal**: Get conversations into a database and let Claude help you review them

1. **Capture**: Chrome extension monitors claude.ai and uploads conversations daily
2. **Store**: PostgreSQL + pgvector for semantic search
3. **Review**: Chat interface where Claude has access to your conversation history
4. **Claude does the work**: You say "quiz me on Python", Claude pulls relevant conversations and helps you review

### V2 - Advanced Features (Future)
- Spaced repetition algorithm (SM-2)
- Automated daily review suggestions
- Standalone quiz mode with scoring
- Retention analytics and dashboards
- Mobile app

## Architecture (V1)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Layer                            │
├─────────────────────────────────────────────────────────────┤
│  Chrome Extension                                            │
│  - Monitors claude.ai DOM for new messages                   │
│  - Captures conversation data                                │
│  - Daily batch upload to backend                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS POST (daily)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                     │
├─────────────────────────────────────────────────────────────┤
│  POST /conversations (ingest from extension)                 │
│  GET  /search (semantic + keyword)                           │
│  GET  /conversations/:id                                     │
│                                                              │
│  MCP Server (exposes data to Claude)                         │
│  - Tool: search_conversations                                │
│  - Tool: get_conversation                                    │
│  - Tool: list_topics                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage                                   │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector                                       │
│  ├── conversations (id, title, created_at, metadata)         │
│  ├── messages (id, conv_id, role, content, timestamp)        │
│  └── embeddings (for semantic search)                        │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Review Interface                            │
├─────────────────────────────────────────────────────────────┤
│  Simple Chat UI (or Claude Code with MCP)                    │
│                                                              │
│  User: "Review what I learned about async/await"             │
│  Claude: [searches indexed conversations]                    │
│          "I found 3 conversations about async. Let me        │
│           quiz you..."                                       │
│                                                              │
│  Claude generates questions on the fly from your data        │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Decisions

### 1. Embedding Strategy
**Decision**: Embed entire conversations as single units (conversation-level embeddings)

**Rationale**:
- Each Claude conversation typically focuses on one cohesive topic
- Simpler implementation for V1
- Reduces embedding API costs (one embedding per conversation vs. per message)
- Works well with 90% of conversations that are single-session

**Implementation**:
- Concatenate conversation title + all messages
- Generate one embedding per conversation
- Store in `conversation_embeddings` table (not message-level)
- For edge case of very long conversations (>10k tokens), implement chunking in V2

### 2. Context Window for Retrieval
**Decision**: Return full conversations when Claude requests them

**Rationale**:
- Claude has 200k token context window - can handle multiple full conversations
- Conversation flow and context matter for understanding and review
- Simpler implementation (no complex excerpt extraction logic)
- Let Claude's intelligence filter and focus on relevant parts

**Two-step retrieval pattern**:
1. `search_conversations(query)` → Returns metadata + snippets (lightweight)
2. `get_conversation(id)` → Returns complete conversation with all messages
3. Claude decides which conversations to fully explore

**Future optimization** (V2): Add `get_conversation_excerpt()` if token limits become an issue

### 3. Multi-day Conversations
**Decision**: Treat each sync as a snapshot; update existing conversation if `claude_conversation_id` already exists

**Rationale**:
- 90% of conversations are single-session
- For the 10% that span days: update in place (upsert pattern)
- Extension sends full conversation; backend deduplicates messages by sequence number
- Regenerate conversation embedding on update

### 4. Design Patterns

**Repository Pattern**: Abstract database operations
- `ConversationRepository`, `MessageRepository`, `EmbeddingRepository`
- Clean separation between business logic and data access

**Service Layer Pattern**: Business logic separate from API routes
- `ConversationService`: handles deduplication, validation
- `EmbeddingService`: manages embedding generation
- `SearchService`: orchestrates semantic search

**Adapter Pattern**: Wrap external APIs
- `EmbeddingAdapter` interface for swapping providers (Anthropic → OpenAI)

**Facade Pattern**: MCP tools simplify complex operations
- `search_conversations()` hides complexity of pgvector queries

### 5. Technology Choice: Node.js
**Decision**: Use Node.js instead of Python for backend

**Rationale**:
- Native async/await support for I/O-heavy operations (database, embeddings API)
- Better concurrency model for handling multiple embedding requests
- TypeScript for type safety
- Consistent ecosystem with potential Next.js frontend
- MCP SDK available for both Python and TypeScript

### 6. Embedding Provider
**Decision**: Use Voyage AI for embeddings (with adapter pattern for flexibility)

**Rationale**:
- Anthropic doesn't offer embeddings (as of 2025)
- Voyage AI: High quality, optimized for search, 1024 dimensions
- Cost: ~$0.10 per 1M tokens (very affordable)
- Alternative: OpenAI text-embedding-3-small (cheaper but slightly lower quality)

**Cost Estimation**:
- 10 conversations/day × 2000 tokens average = 20k tokens/day
- Monthly: ~600k tokens = ~$0.06/month
- Annual: ~$0.72/year for embeddings

**Implementation**: Use Adapter pattern so switching providers is just a config change

### 7. Single-User Architecture
**Decision**: Build for single-user deployment (no multi-tenancy)

**Rationale**:
- Simplifies authentication (single API key in environment variable)
- No need for user management, quotas, or tenant isolation
- Reduces complexity significantly
- Can always add multi-user support in V2 if needed

**Authentication**:
- Backend: Single API key in `.env` file
- Extension: API key stored in `chrome.storage.sync` (encrypted by Chrome)
- Request validation: `Authorization: Bearer <api_key>` header

### 8. Deployment Strategy
**Decision**: Start local → Deploy to Fly.io

**Rationale**:
- Local development: Zero cost, full privacy, fast iteration
- Fly.io production: Free tier sufficient for single user, includes Postgres + pgvector
- Alternative: Railway ($5/month) if Fly.io limits are exceeded

**Local Setup**: Docker Compose for Postgres + backend
**Production**: Fly.io with managed Postgres

## Overlooked Considerations

### 1. Authentication & Security

**API Key Management**:
- Backend stores single API key in environment variable
- Extension stores API key in `chrome.storage.sync`
- All requests require `Authorization: Bearer <key>` header
- Add rate limiting: 100 requests/hour (plenty for single user)

**CORS Configuration**:
```typescript
// Fastify CORS for Chrome extension
fastify.register(cors, {
  origin: ['chrome-extension://*'], // Allow all extension origins
  credentials: true
});
```

**Environment Variables**:
```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/conversations
API_KEY=your-secret-key-here
VOYAGE_API_KEY=your-voyage-key
NODE_ENV=development
```

### 2. Privacy & Data Handling

**Considerations**:
- Conversations may contain sensitive data (API keys, personal info, passwords)
- Local-first approach recommended for V1 (run everything on localhost)
- If deploying to cloud, conversations are stored in your private database
- No data sharing with third parties (except embedding provider sees conversation text)

**Recommendations**:
- Start with local Docker Compose deployment
- Add `.gitignore` for sensitive files:
  ```
  .env
  .env.local
  *.pem
  *.key
  node_modules/
  dist/
  ```
- Consider encryption at rest for V2 (Postgres encryption)

### 3. Chrome Extension Edge Cases

**DOM Structure Changes**:
- Claude.ai will update their UI (breaking your selectors)
- Use multiple selector strategies (fallbacks)
- Version your data format in extension

**Strategy Pattern for Parsing**:
```javascript
const parsers = [
  parseConversationV1, // Current DOM structure
  parseConversationV2, // Fallback if V1 fails
  parseConversationV3  // Nuclear fallback
];

for (const parser of parsers) {
  try {
    const data = parser(document);
    if (data) return data;
  } catch (e) {
    console.log('Parser failed, trying next...');
  }
}
```

**Content Handling**:
- Code blocks: Preserve formatting (use `<pre>` or markdown)
- Images: Store URLs (or skip for V1)
- Artifacts: Extract as separate content blocks
- Deleted conversations: Extension should detect and mark as deleted

**Conversation Metadata**:
- Model used (Sonnet, Opus, Haiku)
- Timestamp accuracy (capture from DOM)
- Conversation state (archived, deleted, etc.)

### 4. Embedding Cost & Rate Limits

**Voyage AI Limits**:
- Rate limit: 300 requests/minute (generous for single user)
- Max tokens per request: 128k tokens
- Batch processing recommended for efficiency

**Background Job Queue**:
- Don't block API response while generating embeddings
- Use simple in-memory queue for V1
- Process embeddings asynchronously after storing conversation

```typescript
// Pseudo-code
app.post('/conversations', async (req, reply) => {
  // 1. Save conversation to DB (fast)
  await conversationService.save(req.body.conversations);

  // 2. Queue embedding generation (async, don't wait)
  embeddingQueue.add(req.body.conversations);

  // 3. Return immediately
  return { success: true };
});
```

**V2 Optimization**: Use BullMQ or similar for persistent job queue

### 5. Database Performance & Indexes

**Additional Indexes** (beyond pgvector):
```sql
-- Query performance indexes
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_claude_id ON conversations(claude_conversation_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sequence ON messages(conversation_id, sequence_number);

-- Vector index tuning (adjust based on dataset size)
CREATE INDEX idx_conversation_embeddings_vector
ON conversation_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- For ~1000-10k conversations
```

**Index Tuning Guidelines**:
- < 1000 conversations: `lists = 10-50`
- 1000-10k conversations: `lists = 100-500`
- > 10k conversations: `lists = sqrt(row_count)`

### 6. Error Handling & Observability

**Extension Error Handling**:
- Failed uploads: Store in local queue, retry on next alarm
- Max retries: 3 attempts with exponential backoff
- User notification: Badge icon if upload fails

**Backend Logging**:
```typescript
// Use pino for structured logging (Fastify default)
fastify.log.info({ conversationId }, 'Generating embedding');
fastify.log.error({ error, conversationId }, 'Embedding generation failed');
```

**Monitoring Essentials**:
- Health check endpoint: `GET /health` (returns DB connection status)
- Log all embedding API calls (for debugging "why isn't this searchable?")
- Track search query performance

**Debug Scenarios**:
- "I uploaded a conversation but can't find it"
  - Check: Was embedding generated? Check logs
  - Check: Is conversation in DB? Query by `claude_conversation_id`
  - Check: Is search query matching? Test with known terms

### 7. Message Deduplication Logic

**Upsert Strategy**:
```typescript
async upsertConversation(data: ConversationData) {
  // 1. Check if conversation exists
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.claudeConversationId, data.id))
    .limit(1);

  if (existing.length === 0) {
    // New conversation: insert all
    await this.insertNew(data);
    await embeddingService.generate(data);
  } else {
    // Existing conversation: check if changed
    if (existing[0].messageCount !== data.messages.length) {
      // Messages added: upsert messages by sequence_number
      await this.upsertMessages(existing[0].id, data.messages);
      // Regenerate embedding (conversation changed)
      await embeddingService.regenerate(existing[0].id);
    }
    // else: no changes, skip
  }
}
```

**Message Upsert**:
- Use `sequence_number` as unique identifier within conversation
- Detect edits: Compare content for same sequence number
- Handle deletions: V2 feature (requires tracking deleted messages)

### 8. Conversation Snippet Generation

**Search Result Snippet Strategy** (V1):
- Use first user message (most representative of conversation topic)
- Truncate to 200 characters
- Add ellipsis if truncated

```typescript
function generateSnippet(conversation: Conversation): string {
  const firstUserMessage = conversation.messages
    .find(m => m.role === 'user')?.content || '';

  if (firstUserMessage.length <= 200) {
    return firstUserMessage;
  }

  return firstUserMessage.substring(0, 197) + '...';
}
```

**V2 Enhancement**: Use LLM to generate semantic summaries (costs ~$0.001 per conversation)

### 9. MCP Server Deployment

**Architecture**:
- Separate Node.js process from backend API
- Shares database connection pool
- Uses stdio transport (standard for MCP)

**File Structure**:
```
/backend
  /src
    /api          # Fastify REST API
    /mcp          # MCP server
    /repositories # Shared DB access
    /services     # Shared business logic

/mcp-server
  server.ts       # MCP entry point
```

**User Installation**:
```json
// ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "jarvis": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### 10. Conversation Title Handling

**Edge Cases**:
- New conversations: Title may be `null` or "New conversation"
- Untitled conversations: User never gave it a title
- Default titles: Claude.ai generates generic titles

**Backend Strategy**:
```typescript
interface Conversation {
  title: string | null;  // Allow null
  // ...
}

function getDisplayTitle(conversation: Conversation): string {
  if (conversation.title && conversation.title !== 'New conversation') {
    return conversation.title;
  }

  // Fallback: First 50 chars of first user message
  const firstMessage = conversation.messages
    .find(m => m.role === 'user')?.content;

  if (firstMessage) {
    return firstMessage.substring(0, 50) + '...';
  }

  return 'Untitled Conversation';
}
```

**V2 Enhancement**: Generate smart titles using LLM based on conversation content

### 11. Testing Strategy

**V1 Testing Priorities**:
1. **Repository Tests** (unit tests with mock DB)
   - Test upsert logic
   - Test deduplication
   - Test vector search queries

2. **Embedding Service Tests** (integration tests)
   - Mock Voyage API
   - Test concatenation logic
   - Test error handling

3. **API Tests** (integration tests)
   - Test `/conversations` endpoint with sample data
   - Test authentication (valid/invalid API key)
   - Test search endpoint

**Testing Stack**:
- **Vitest**: Fast, TypeScript-native, ESM support
- **Testcontainers**: Spin up real Postgres for integration tests
- **Supertest**: HTTP assertions for API tests

**Example Test**:
```typescript
import { describe, it, expect } from 'vitest';
import { ConversationRepository } from './conversation.repository';

describe('ConversationRepository', () => {
  it('should upsert conversation with same claude_conversation_id', async () => {
    const repo = new ConversationRepository(db);

    // First insert
    await repo.upsert('conv-123', { title: 'Original' });

    // Second insert (should update)
    await repo.upsert('conv-123', { title: 'Updated' });

    const result = await repo.findByClaudeId('conv-123');
    expect(result.title).toBe('Updated');
  });
});
```

### 12. Development Environment Setup

**Docker Compose for Local Development**:
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
      API_KEY: dev-secret-key
      VOYAGE_API_KEY: ${VOYAGE_API_KEY}
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  pgdata:
```

**Getting Started**:
```bash
# 1. Clone repo
git clone <repo>
cd claude-jarvis

# 2. Install dependencies
cd backend && npm install

# 3. Start services
docker-compose up -d

# 4. Run migrations
npm run db:migrate

# 5. Start development server
npm run dev
```

### 13. Backup & Data Portability

**V1 Backup Strategy**:
- Manual Postgres backup: `pg_dump conversations > backup.sql`
- Automated backups in V2
- Fly.io/Railway provide automated DB backups

**Data Export**:
```typescript
// GET /api/v1/export
// Returns all conversations as JSON
app.get('/export', async (req, reply) => {
  const conversations = await db
    .select()
    .from(conversationsTable)
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id));

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    conversations
  };
});
```

**Import from Backup** (V2):
- Accept exported JSON
- Regenerate embeddings
- Useful for migrating between databases

### 14. Deployment Options

**Recommended Path**: Local → Fly.io → Railway (if needed)

#### Option 1: Local Docker Compose (Development)
**Cost**: $0
**Setup Time**: 5 minutes
**Pros**: Zero cost, full privacy, fast iteration
**Cons**: Only works when computer is on

#### Option 2: Fly.io (Production - Free Tier)
**Cost**: $0 (free tier: 3 VMs, 3GB Postgres)
**Setup Time**: 15 minutes
**Pros**: Free tier sufficient for single user, auto HTTPS, global edge
**Cons**: Free tier limits (should be fine for this use case)

```bash
# Deploy to Fly.io
fly launch
fly postgres create --name conversations-db
fly secrets set API_KEY=your-secret-key
fly secrets set VOYAGE_API_KEY=your-voyage-key
fly deploy
```

#### Option 3: Railway (Paid Fallback)
**Cost**: $5-8/month
**Setup Time**: 10 minutes
**Pros**: Generous free trial ($5 credit), beautiful UI, one-click Postgres
**Cons**: Costs money after trial

#### Option 4: Oracle Cloud (Advanced - Free Forever)
**Cost**: $0 (forever free tier: 4 ARM cores, 24GB RAM)
**Setup Time**: 1-2 hours (VPS setup)
**Pros**: Very generous free tier, no time limit
**Cons**: More setup work, need to manage VPS

**Recommendation**: Start local, deploy to Fly.io when ready for production

## Implementation Plan (V1 Only)

### Phase 1: Chrome Extension (Week 1)
- [ ] Extension boilerplate (manifest.json, content script)
- [ ] Monitor claude.ai DOM and capture conversations
- [ ] Store locally in chrome.storage.local
- [ ] Daily upload scheduler (chrome.alarms)
- [ ] Settings page for API endpoint configuration

### Phase 2: Backend Storage (Week 2)
- [ ] Fastify + TypeScript setup
- [ ] PostgreSQL + pgvector schema:
  - conversations table
  - messages table
  - conversation_embeddings table (conversation-level, not message-level)
- [ ] POST /conversations endpoint (receive from extension)
- [ ] Generate embeddings for conversations (Anthropic/Voyage AI API)
  - Concatenate title + all messages for embedding input
  - Store one embedding per conversation
- [ ] Implement upsert logic for multi-day conversations
- [ ] Basic authentication (API keys)

### Phase 3: Search & Retrieval (Week 3)
- [ ] GET /search endpoint (semantic + keyword)
- [ ] GET /conversations/:id endpoint
- [ ] Test semantic search quality
- [ ] Optimize query performance

### Phase 4: MCP Server (Week 4)
- [ ] Build MCP server that exposes conversation data
- [ ] Tools:
  - `search_conversations(query, limit)`
  - `get_conversation(id)`
  - `list_topics()` (extract topics from conversations)
- [ ] Test MCP server with Claude Code/Desktop

### Phase 5: Review Interface (Week 5)
**Option A**: Use Claude Code + MCP (simplest)
- Just install the MCP server
- Chat with Claude in Claude Code
- Claude can search your conversations via MCP tools

**Option B**: Simple web chat UI
- Next.js chat interface
- Calls Claude API with conversation context
- User asks for review, Claude searches and helps

Choose whichever is easier to start!

## Tech Stack (V1)

### Chrome Extension
- Vanilla JavaScript
- Manifest V3
- chrome.storage.local + chrome.alarms

### Backend
- **Runtime**: Node.js (v20+)
- **Framework**: Fastify or Express (TBD - see framework comparison below)
- **Language**: TypeScript
- **Database**: PostgreSQL with pgvector extension
- **ORM/Query Builder**: Drizzle ORM or Kysely (type-safe)
- **Embeddings**: Anthropic Claude API embeddings
- **Deployment**: Railway / Render / Fly.io (or local)

### MCP Server
- TypeScript (using @modelcontextprotocol/sdk)
- Shares database connection with backend
- Exposes search tools to Claude

### Review Interface (Pick One)
- **Option A**: Claude Code + MCP server (no UI needed!)
- **Option B**: Next.js simple chat UI + Claude API

## Database Schema (V1)

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    claude_conversation_id VARCHAR(255) UNIQUE,
    title TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    message_count INTEGER
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id),
    role VARCHAR(20), -- 'user' or 'assistant'
    content TEXT,
    timestamp TIMESTAMP,
    sequence_number INTEGER
);

-- pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation-level embeddings (not message-level)
CREATE TABLE conversation_embeddings (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) UNIQUE,
    embedding vector(1024), -- Voyage AI / Anthropic embedding dimension
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops);
```

## API Endpoints (V1)

### Chrome Extension → Backend
```
POST /api/v1/conversations
Body: {
  "conversations": [
    {
      "id": "claude_conv_id",
      "title": "Conversation title",
      "created_at": "2025-12-01T10:00:00Z",
      "messages": [
        {
          "role": "user",
          "content": "...",
          "timestamp": "2025-12-01T10:00:00Z"
        },
        {
          "role": "assistant",
          "content": "...",
          "timestamp": "2025-12-01T10:00:30Z"
        }
      ]
    }
  ]
}
```

### Search
```
GET /api/v1/search?q=async+python&limit=10
Response: {
  "results": [
    {
      "conversation_id": "uuid",
      "title": "Python Async Deep Dive",
      "relevance_score": 0.92,
      "snippet": "...discussion about asyncio...",
      "created_at": "2025-11-15"
    }
  ]
}

GET /api/v1/conversations/:id
Response: {
  "id": "uuid",
  "title": "...",
  "messages": [...]
}
```

## MCP Server Tools (V1)

```python
# Tool 1: Search conversations
@mcp_tool
def search_conversations(query: str, limit: int = 10):
    """
    Search across all indexed conversations using semantic search
    """
    # Query pgvector for similar conversations
    # Return conversation summaries
    pass

# Tool 2: Get full conversation
@mcp_tool
def get_conversation(conversation_id: str):
    """
    Retrieve full conversation by ID
    """
    # Return all messages in conversation
    pass

# Tool 3: List topics
@mcp_tool
def list_topics(limit: int = 20):
    """
    Get most discussed topics across all conversations
    """
    # Cluster conversations by topic
    # Return topic list
    pass
```

## Usage Example (V1)

### Scenario: Review Session

**User opens Claude Code (with MCP server installed):**

```
User: "I want to review what I learned about system design last month"

Claude: [calls search_conversations("system design")]
        [finds 5 relevant conversations]

        "I found 5 conversations about system design from last month:
        1. Microservices vs Monoliths (Nov 12)
        2. Database Sharding Strategies (Nov 18)
        3. Load Balancing Patterns (Nov 25)

        Would you like me to quiz you on any of these topics?"

User: "Quiz me on microservices"

Claude: [calls get_conversation(conv_id)]
        [reads the full conversation]

        "Great! Let's start:

        Question 1: In our discussion, we talked about the main
        tradeoffs of microservices. Can you name 3 disadvantages?"

User: [answers]

Claude: "Good! You mentioned distributed complexity and network
        overhead. We also discussed operational burden - managing
        many services requires more DevOps infrastructure.

        Question 2: ..."
```

**The beauty**: No separate quiz engine needed! Claude generates questions naturally from your data.

## V2 Features (Future - Move These Later)

Once v1 is working, add:
- Spaced repetition system (SM-2 algorithm)
- Review cards with automated scheduling
- Daily "what to review today" suggestions
- Standalone quiz mode with scoring
- Retention analytics dashboard
- Progress tracking and streaks
- Mobile app

## Getting Started (V1 - Keep It Simple)

1. **Week 1**: Build Chrome extension, test data capture
2. **Week 2**: Set up backend, store conversations in PostgreSQL
3. **Week 3**: Add embeddings and search
4. **Week 4**: Build MCP server
5. **Week 5**: Test review workflow with Claude Code

**Goal**: By end of week 5, you can chat with Claude who has full memory of all your past conversations.

## Why This Approach Works

1. **Leverage Claude's intelligence**: Don't build a quiz engine, let Claude generate questions
2. **Simpler v1**: No complex spaced repetition, just search + retrieval
3. **MCP is perfect for this**: Give Claude tools to access your data
4. **Natural interaction**: Review feels like a conversation, not a quiz app
5. **Easy to extend**: v2 can add automation on top of this foundation

## Notes

- Start with local deployment (easier)
- Consider using Claude Code + MCP for review (no UI to build)
- pgvector handles semantic search natively
- Can always build web UI later if MCP approach doesn't work
