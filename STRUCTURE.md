# Project Structure

```
claude-jarvis/
├── .github/
│   └── workflows/                # CI/CD workflows
│
├── backend/
│   ├── src/
│   │   ├── api/                  # HTTP API Layer
│   │   │   ├── routes/           # Route definitions
│   │   │   ├── controllers/      # Request handlers
│   │   │   └── middleware/       # Auth, CORS, rate limiting
│   │   │
│   │   ├── domain/               # Business Logic Layer
│   │   │   ├── entities/         # TypeScript interfaces/types
│   │   │   ├── repositories/     # DB access (Drizzle ORM)
│   │   │   └── services/         # Business logic
│   │   │
│   │   ├── infrastructure/       # External Services Layer
│   │   │   ├── db/               # Database config, migrations, schema
│   │   │   ├── embedding-providers/  # Voyage AI, OpenAI adapters
│   │   │   └── mcp/              # MCP server
│   │   │
│   │   └── shared/               # Shared Utilities
│   │       ├── config/           # Environment config
│   │       ├── types/            # Global types
│   │       └── utils/            # Helper functions
│   │
│   ├── tests/                    # Tests (mirrors src structure)
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts         # Drizzle ORM config
│   └── Dockerfile
│
├── extension/
│   ├── src/
│   │   ├── background/           # Service worker (alarms, uploads)
│   │   ├── content/              # Content script (DOM capture)
│   │   ├── popup/                # Extension popup UI
│   │   └── types/                # TypeScript types
│   │
│   ├── manifest.json             # Chrome extension manifest
│   ├── package.json
│   └── README.md
│
├── docs/
│   ├── ARCHITECTURE.md           # Design decisions
│   ├── IMPLEMENTATION.md         # Setup & implementation guide
│   └── API.md                    # API documentation
│
├── docker-compose.yml            # Local development setup
├── .gitignore
├── .env.example
├── PROJECT.md                    # Complete specification
├── README.md                     # Quick start guide
└── STRUCTURE.md                  # This file
```

## Layer Responsibilities

### API Layer (`api/`)
- HTTP endpoints (Fastify routes)
- Request validation
- Response formatting
- Middleware (auth, CORS, rate limiting)

### Domain Layer (`domain/`)
- **Entities**: TypeScript interfaces (Conversation, Message, Embedding)
- **Repositories**: Database operations (CRUD, queries)
- **Services**: Business logic (deduplication, search, embedding generation)

### Infrastructure Layer (`infrastructure/`)
- **db/**: Drizzle schema, migrations, connection pool
- **embedding-providers/**: Adapters for Voyage AI, OpenAI
- **mcp/**: MCP server tools (search_conversations, get_conversation)

### Shared (`shared/`)
- Configuration management
- Global types
- Utility functions (logging, error handling)

## Key Files

### Backend
```
backend/src/
├── api/
│   ├── routes/
│   │   ├── index.ts              # Route registration
│   │   ├── conversations.ts      # POST /conversations
│   │   └── search.ts             # GET /search
│   ├── controllers/
│   │   ├── conversation.controller.ts
│   │   └── search.controller.ts
│   └── middleware/
│       ├── auth.ts               # API key validation
│       └── rate-limit.ts         # Rate limiting
│
├── domain/
│   ├── entities/
│   │   ├── conversation.ts       # Conversation interface
│   │   ├── message.ts            # Message interface
│   │   └── embedding.ts          # Embedding interface
│   ├── repositories/
│   │   ├── conversation.repository.ts
│   │   ├── message.repository.ts
│   │   └── embedding.repository.ts
│   └── services/
│       ├── conversation.service.ts   # Upsert logic
│       ├── embedding.service.ts      # Generate embeddings
│       └── search.service.ts         # Semantic search
│
├── infrastructure/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── migrations/           # SQL migrations
│   │   └── connection.ts         # DB connection pool
│   ├── embedding-providers/
│   │   ├── embedding.adapter.ts  # Interface
│   │   ├── voyage.adapter.ts     # Voyage AI implementation
│   │   └── openai.adapter.ts     # OpenAI implementation
│   └── mcp/
│       └── server.ts             # MCP server with tools
│
├── shared/
│   ├── config/
│   │   └── index.ts              # Load .env
│   ├── types/
│   │   └── index.ts              # Global types
│   └── utils/
│       ├── logger.ts             # Pino logger
│       └── errors.ts             # Error classes
│
└── index.ts                      # Application entry point
```

### Extension
```
extension/src/
├── background/
│   ├── index.ts                  # Service worker entry
│   ├── scheduler.ts              # chrome.alarms for daily upload
│   └── uploader.ts               # Upload to backend
│
├── content/
│   ├── index.ts                  # Content script entry
│   ├── parsers/
│   │   ├── v1.ts                 # Current DOM parser
│   │   ├── v2.ts                 # Fallback parser
│   │   └── index.ts              # Parser strategy
│   └── storage.ts                # chrome.storage operations
│
├── popup/
│   ├── index.html
│   ├── index.ts
│   └── styles.css
│
└── types/
    └── index.ts                  # Shared types
```

## Data Flow

### Conversation Capture Flow
```
Claude.ai → Content Script → chrome.storage.local → Background Service Worker
    → Daily Alarm → Upload to Backend → DB → Embedding Service (async)
```

### Search Flow
```
Claude (MCP) → MCP Server → SearchService → PostgreSQL (pgvector)
    → Results → MCP Server → Claude
```

## Design Patterns Applied

1. **Repository Pattern**: `repositories/` - abstract DB operations
2. **Service Layer**: `services/` - business logic
3. **Adapter Pattern**: `embedding-providers/` - swap providers
4. **Strategy Pattern**: `content/parsers/` - multiple DOM parsing strategies
5. **Facade Pattern**: `mcp/server.ts` - simplify complex operations for Claude
