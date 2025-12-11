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

The API will be available at `http://localhost:8080`

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

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOCAL MACHINE                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐      stdio       ┌─────────────────────┐   │
│  │  Claude Desktop │◄────────────────►│   MCP Server        │   │
│  │                 │                  │   (npx tsx ...)     │   │
│  └─────────────────┘                  └──────────┬──────────┘   │
│                                                  │              │
│  ┌─────────────────┐                             │              │
│  │ Chrome Extension│ ────────────────────────────┼──────┐       │
│  │  (claude.ai)    │                             │      │       │
│  └─────────────────┘                             │      │       │
└──────────────────────────────────────────────────│──────│───────┘
                                                   │      │
                                                   │HTTPS │HTTPS
                                                   ▼      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REMOTE SERVER                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Backend API                          │    │
│  │  POST /api/v1/conversations     (ingest from extension) │    │
│  │  GET  /api/v1/conversations/search    (semantic search) │    │
│  │  GET  /api/v1/conversations/date-range  (date filter)   │    │ 
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              PostgreSQL + pgvector                      │    │
│  │  • conversations (metadata)                             │    │
│  │  • messages (full text)                                 │    │
│  │  • conversation_embeddings (1024-D vectors)             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Capture**: Chrome extension monitors claude.ai and stores conversations locally
2. **Sync**: Daily alarm (or manual trigger) POSTs conversations to backend API
3. **Index**: Backend upserts conversations and queues them for embedding generation
4. **Embed**: Voyage AI generates 1024-D vectors, stored in pgvector
5. **Search**: MCP server exposes `search_conversations` and `get_conversations_by_date` tools
6. **Query**: Claude Desktop calls MCP tools → API → vector similarity search → returns top 5 matches

### Key Decisions

- **Conversation-level embeddings** (not per-message) - simpler, cheaper
- **Return full conversations** - Claude has 200k context window
- **Single-user** - no auth complexity
- **Local-first option** - privacy, zero cost

> **⚠️ Not Production Ready**
> Authentication uses a simple Bearer token comparison—no JWT, OAuth, or OIDC.
> Input validation is minimal. This is a personal project; do not deploy to production
> or expose to untrusted users without implementing proper security measures.

## Project Structure

```
├── backend/
│   └── src/
│       ├── api/
│       │   ├── controllers/     # Request handlers
│       │   ├── middleware/      # Auth, validation, rate-limiting
│       │   └── routes/          # Route definitions
│       ├── domain/
│       │   ├── repositories/    # DB access (Drizzle ORM)
│       │   └── services/        # Business logic
│       ├── infrastructure/
│       │   ├── db/              # Database connection & schema
│       │   └── embedding-providers/  # Voyage AI adapter
│       ├── mcp/                 # MCP server (tools, api-client)
│       ├── config/              # Environment & app config
│       ├── schemas/             # Zod validation schemas
│       ├── errors/              # Custom error classes
│       └── test/                # Unit & integration tests
│
├── extension/
│   ├── src/
│   │   ├── background/          # Service worker (sync logic)
│   │   ├── content/             # Content script (DOM capture)
│   │   ├── popup/               # Extension popup UI
│   │   ├── lib/                 # Shared utilities
│   │   └── types/               # TypeScript definitions
│   └── icons/                   # Extension icons
│
├── scripts/                     # Utility scripts
└── data/                        # Local data storage
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
search_conversations(query, limit?)  
get_conversation(id)                
```