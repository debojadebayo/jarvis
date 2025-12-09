# Jarvis Indexer

> Make all your Claude.ai conversations searchable and reviewable with AI assistance

## What It Does

Captures your Claude.ai conversations, indexes them with semantic search, and lets Claude help you review what you've learned.

**Simple workflow:**
1. Chrome extension captures conversations daily
2. Backend stores them in PostgreSQL with vector embeddings
3. MCP server exposes data to Claude
4. You ask: "Quiz me on Python async" → Claude finds relevant conversations and creates a review session

## Quick Start

```bash
# 1. Start local environment
docker-compose up -d

# 2. Install dependencies
cd backend && npm install

# 3. Run migrations
npm run db:migrate

# 4. Start backend
npm run dev

# 5. Load Chrome extension (see /extension/README.md)
```

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Extension** | Vanilla JS, Manifest V3 | Simple, no build step |
| **Backend** | Fastify + TypeScript | Fast, async-first, type-safe |
| **Database** | PostgreSQL + pgvector | Vector search built-in |
| **ORM** | Drizzle ORM |  type-safe |
| **Embeddings** | Voyage AI | High quality, $0.72/year |
| **MCP Server** | TypeScript | Exposes data to Claude |
| **Hosting** | Local → Fly.io | Free tier, zero config |

## Architecture

```
Chrome Extension → Backend API → PostgreSQL + pgvector → MCP Server → Claude
```

**Key Decisions:**
- **Conversation-level embeddings** (not per-message) - simpler, cheaper
- **Return full conversations** - Claude has 200k context window
- **Single-user** - no auth complexity
- **Local-first** - privacy, zero cost

## Project Structure

```
/backend
  /src
    /api           # Fastify REST endpoints
    /repositories  # DB access (Drizzle ORM)
    /services      # Business logic
    /mcp           # MCP server tools
  /migrations      # Database migrations
/extension
  /src             # Chrome extension code
/docs              #Various md files to walk through development 
```

## Database Schema

```sql
conversations (id, claude_conversation_id, title, created_at, message_count)
messages (id, conversation_id, role, content, sequence_number)
conversation_embeddings (id, conversation_id, embedding vector(1024))
```

## API Endpoints

```
POST /api/v1/conversations   # Extension uploads conversations
GET  /api/v1/search          # Semantic search
GET  /api/v1/conversations/:id # Get full conversation
```

## MCP Tools

```typescript
search_conversations(query, limit)  // Find relevant conversations
get_conversation(id)                // Get full conversation
list_topics(limit)                  // Get most discussed topics
```

## Cost Estimate

- **Local development**: $0
- **Embeddings**: ~$0.72/year (10 conversations/day)
- **Fly.io hosting**: $0 (free tier) or $3-5/month
- **Total**: Under $10/year

## Why This Works

- **Leverage Claude**: No quiz engine needed, Claude generates questions from your data
- **Simple V1**: Just capture, search, retrieve
- **MCP is perfect**: Give Claude tools to access your data
- **Natural interaction**: Review feels like a conversation
- **Easy to extend**: V2 can add spaced repetition, analytics, etc.
