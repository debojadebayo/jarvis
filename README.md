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

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- [Voyage AI API key](https://www.voyageai.com/)

### Environment Setup

```bash
# Copy example env and fill in your values
cp .env.example .env
```

---

### Option 1: Local Development (Recommended for Development)

Run the backend locally with just the database in Docker.

```bash
# 1. Start PostgreSQL with pgvector
docker compose up postgres -d

# 2. Install dependencies
cd backend && npm install

# 3. Run database migrations (connects to Postgres via localhost:5432)
# Only needed on first setup or after schema changes
docker compose exec app.server npm run db:migrate

# 4. Start the backend server
npm run dev
```

The API will be available at `http://localhost:3000`

---

### Option 2: Full Docker Deployment

Run everything in Docker containers.

```bash
# 1. Build and start all services
docker compose up -d --build

# 2. Run database migrations (only needed on first setup or after schema changes)
docker compose exec app.server npm run db:migrate

# 3. Check logs
docker compose logs -f app.server
```

The API will be available at `http://localhost:3000`

**Useful commands:**
```bash
docker compose down          # Stop all services
docker compose down -v       # Stop and remove volumes (reset DB)
docker compose logs postgres # View database logs
```

---

### Load Chrome Extension

See [extension/README.md](extension/README.md) for installation instructions.

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
