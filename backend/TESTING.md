# Jarvis Backend - Setup & Testing Guide

## Prerequisites

- Docker & Docker Compose installed
- Node.js 22+
- npm 10+

---

## Phase 1: Environment Setup

### 1.1 Create Environment File

```bash
cd backend
cp .env.example .env
```

Create `.env` with:
```env
DATABASE_URL=postgresql://postgres:123@localhost:5432/jarvisbrain
API_KEY=your-api-key-min-16-chars
VOYAGEAI_API_KEY=your-voyage-api-key
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
```

### 1.2 Start Database Only

```bash
# From project root
docker compose up postgres -d

# Verify it's running
docker compose ps
docker compose logs postgres
```

### 1.3 Enable pgvector Extension

Before running migrations, enable the vector extension:

```bash
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Verify:
```bash
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "\dx"
```

You should see `vector` in the list.

### 1.4 Run Database Migrations

```bash
cd backend
npm install
npm run db:migrate
```

Verify tables exist:
```bash
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "\dt"
```

Expected output:
```
                 List of relations
 Schema |          Name           | Type  |  Owner
--------+-------------------------+-------+----------
 public | conversations           | table | postgres
 public | conversations_embeddings| table | postgres
 public | messages                | table | postgres
```

---

## Phase 2: Start the Backend

### 2.1 Run Locally (Development)

```bash
cd backend
npm run dev
```

### 2.2 Run with Docker

```bash
# From project root
docker compose up --build
```

---

## Phase 3: Manual API Testing

### 3.1 Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Expected: {"status":"ok"}
```

```bash
# Database health
curl http://localhost:3000/dbhealth

# Expected: {"status":"Ok","database":"Connected"}
```

### 3.2 Authentication Test

```bash
# Without token - should fail
curl http://localhost:3000/api/v1/conversations/search?query=test

# Expected: 401 Unauthorized
```

```bash
# With invalid token - should fail
curl -H "Authorization: Bearer wrong-token" \
  http://localhost:3000/api/v1/conversations/search?query=test

# Expected: 403 Forbidden
```

### 3.3 Ingest Conversations

```bash
# Ingest a test conversation
curl -X POST http://localhost:3000/api/v1/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  -d '{
    "conversations": [
      {
        "id": "test-conv-001",
        "title": "Test Conversation About TypeScript",
        "created_at": "2024-01-15T10:30:00Z",
        "messages": [
          {
            "role": "user",
            "content": "How do I use TypeScript generics?",
            "timestamp": "2024-01-15T10:30:00Z"
          },
          {
            "role": "assistant",
            "content": "TypeScript generics allow you to write reusable code that works with multiple types...",
            "timestamp": "2024-01-15T10:30:15Z"
          }
        ]
      }
    ]
  }'

# Expected: {"success":true,"processed":1,"created":1,"updated":0}
```

### 3.4 Ingest Multiple Conversations

```bash
curl -X POST http://localhost:3000/api/v1/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  -d '{
    "conversations": [
      {
        "id": "test-conv-002",
        "title": "React Hooks Discussion",
        "created_at": "2024-01-16T14:00:00Z",
        "messages": [
          {
            "role": "user",
            "content": "Explain useEffect cleanup functions",
            "timestamp": "2024-01-16T14:00:00Z"
          },
          {
            "role": "assistant",
            "content": "The cleanup function in useEffect runs before the component unmounts...",
            "timestamp": "2024-01-16T14:00:20Z"
          }
        ]
      },
      {
        "id": "test-conv-003",
        "title": "Database Design Chat",
        "created_at": "2024-01-17T09:00:00Z",
        "messages": [
          {
            "role": "user",
            "content": "What is database normalization?",
            "timestamp": "2024-01-17T09:00:00Z"
          },
          {
            "role": "assistant",
            "content": "Database normalization is the process of organizing data to reduce redundancy...",
            "timestamp": "2024-01-17T09:00:30Z"
          }
        ]
      }
    ]
  }'

# Expected: {"success":true,"processed":2,"created":2,"updated":0}
```

### 3.5 Update Existing Conversation (Upsert)

```bash
# Add more messages to existing conversation
curl -X POST http://localhost:3000/api/v1/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  -d '{
    "conversations": [
      {
        "id": "test-conv-001",
        "title": "Test Conversation About TypeScript",
        "created_at": "2024-01-15T10:30:00Z",
        "messages": [
          {
            "role": "user",
            "content": "How do I use TypeScript generics?",
            "timestamp": "2024-01-15T10:30:00Z"
          },
          {
            "role": "assistant",
            "content": "TypeScript generics allow you to write reusable code...",
            "timestamp": "2024-01-15T10:30:15Z"
          },
          {
            "role": "user",
            "content": "Can you show me an example?",
            "timestamp": "2024-01-15T10:31:00Z"
          },
          {
            "role": "assistant",
            "content": "Sure! Here is an example of a generic function...",
            "timestamp": "2024-01-15T10:31:30Z"
          }
        ]
      }
    ]
  }'

# Expected: {"success":true,"processed":1,"created":0,"updated":1}
```

### 3.6 Search Conversations (Semantic)

> Note: Requires embeddings to be generated. Check queue processing.

```bash
curl -G http://localhost:3000/api/v1/conversations/search \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  --data-urlencode "query=typescript generics"

# Expected: Array of matching conversations with messages
```

### 3.7 Date Range Query

```bash
# Get conversations from a date range
curl -G http://localhost:3000/api/v1/conversations/date-range \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  --data-urlencode "from=2024-01-15T00:00:00Z" \
  --data-urlencode "to=2024-01-17T23:59:59Z"

# Expected: Array of conversations within date range
```

```bash
# Get conversations from a specific date onwards
curl -G http://localhost:3000/api/v1/conversations/date-range \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  --data-urlencode "from=2024-01-16T00:00:00Z"

# Expected: Conversations created on or after Jan 16
```

### 3.8 Validation Error Tests

```bash
# Empty conversations array
curl -X POST http://localhost:3000/api/v1/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  -d '{"conversations": []}'

# Expected: 400 Bad Request - validation error
```

```bash
# Missing required field
curl -X POST http://localhost:3000/api/v1/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-min-16-chars" \
  -d '{
    "conversations": [
      {
        "id": "test",
        "title": "Missing messages"
      }
    ]
  }'

# Expected: 400 Bad Request - messages required
```

### 3.9 Rate Limiting Test

```bash
# Run this in a loop to trigger rate limit
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:3000/health
done

# After ~100 requests, should see 429 (Too Many Requests)
```

---

## Phase 4: Database Verification

### 4.1 Check Data in Database

```bash
# Count conversations
docker exec -it jarvis-db psql -U postgres -d jarvisbrain \
  -c "SELECT COUNT(*) FROM conversations;"

# View conversations
docker exec -it jarvis-db psql -U postgres -d jarvisbrain \
  -c "SELECT id, claude_conversation_id, title, message_count FROM conversations;"

# View messages
docker exec -it jarvis-db psql -U postgres -d jarvisbrain \
  -c "SELECT conversation_id, role, LEFT(content, 50) as content_preview FROM messages;"

# Check embeddings
docker exec -it jarvis-db psql -U postgres -d jarvisbrain \
  -c "SELECT conversation_id, created_at FROM conversations_embeddings;"
```

### 4.2 Check for Missing Embeddings

```bash
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "
SELECT c.id, c.title
FROM conversations c
LEFT JOIN conversations_embeddings e ON c.id = e.conversation_id
WHERE e.id IS NULL;
"
```

---

## Phase 5: Unit Testing

### 5.1 Run All Tests

```bash
cd backend
npm test
```

### 5.2 Run Tests with UI

```bash
npm run test:ui
```

### 5.3 Run Specific Test File

```bash
npm test -- src/domain/services/conversation.service.test.ts
```

### 5.4 Test Coverage (if configured)

```bash
npm test -- --coverage
```

---

## Phase 6: Cleanup

### 6.1 Reset Database

```bash
# Drop all data (keeps schema)
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "
TRUNCATE conversations CASCADE;
"
```

### 6.2 Stop Everything

```bash
docker compose down
```

### 6.3 Full Reset (including volumes)

```bash
docker compose down -v
```

---

## Troubleshooting

### Database Connection Failed
```bash
# Check if postgres is running
docker compose ps

# Check postgres logs
docker compose logs postgres

# Verify connection from host
psql postgresql://postgres:123@localhost:5432/jarvisbrain
```

### Migrations Failed
```bash
# Check if pgvector extension exists
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "\dx"

# If not, create it
docker exec -it jarvis-db psql -U postgres -d jarvisbrain -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### API Returns 500
```bash
# Check backend logs
docker compose logs backend

# Or if running locally, check terminal output
```

### Embeddings Not Being Generated
- Check if VOYAGEAI_API_KEY is set correctly
- Check the embedding queue status
- Look for errors in logs related to VoyageAI API calls
