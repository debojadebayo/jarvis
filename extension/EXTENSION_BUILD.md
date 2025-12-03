# Chrome Extension Build Notes

## Overview

This document describes how the Jarvis Chrome extension is built to capture Claude.ai conversations.

## Architecture

```
extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── icons/                  # Extension icons (16, 48, 128px)
└── src/
    ├── background/
    │   └── service-worker.js   # Background service worker
    ├── content/
    │   └── content.js          # Content script injected into claude.ai
    ├── popup/
    │   ├── popup.html          # Popup UI
    │   ├── popup.css           # Popup styles
    │   └── popup.js            # Popup logic
    └── types/
        └── types.js            # JSDoc type definitions
```

## Components

### 1. Manifest (manifest.json)

Uses **Manifest V3** (required for new Chrome extensions):

- **Permissions**:
  - `storage` - For storing conversations locally
  - `alarms` - For scheduling daily sync
  - `activeTab` - For accessing current tab

- **Host Permissions**:
  - `https://claude.ai/*` - Only runs on Claude.ai

- **Content Script**: Injected into claude.ai pages at `document_idle`
- **Service Worker**: Background script for handling alarms and sync

### 2. Content Script (content.js)

Responsible for capturing conversation data from claude.ai DOM.

**Key Features**:

1. **Multi-Strategy Parsing**: Uses multiple selector strategies to handle DOM changes
   ```javascript
   // Strategy 1: data-testid attributes
   // Strategy 2: Class-based selectors
   // Strategy 3: Generic prose blocks (fallback)
   ```

2. **MutationObserver**: Watches for DOM changes to detect new messages
   ```javascript
   const observer = new MutationObserver((mutations) => {
     // Detect new messages and trigger capture
   });
   ```

3. **Debounced Capture**: Avoids excessive captures during rapid changes
   - 1 second debounce delay
   - Only saves if message count changed

4. **URL Change Detection**: Handles SPA navigation
   ```javascript
   setInterval(() => {
     if (window.location.href !== lastUrl) {
       // New conversation, trigger capture
     }
   }, 1000);
   ```

**Data Extraction**:

- **Conversation ID**: Extracted from URL `/chat/{uuid}`
- **Title**: From page title or first user message
- **Messages**: Role, content, timestamp, sequence number
- **Code Blocks**: Preserved with markdown formatting

### 3. Service Worker (service-worker.js)

Handles background tasks and communication.

**Features**:

1. **Daily Sync Alarm**:
   ```javascript
   chrome.alarms.create(SYNC_ALARM_NAME, {
     periodInMinutes: 24 * 60,  // Daily
     delayInMinutes: 1          // First sync after 1 min
   });
   ```

2. **Backend Sync**:
   - POSTs conversations to configured API endpoint
   - Uses Bearer token authentication
   - Tracks last sync time

3. **Message Handling**:
   - `GET_STATUS` - Returns conversation count, last sync, API status
   - `TRIGGER_SYNC` - Manual sync trigger
   - `GET_CONVERSATIONS` - Returns all stored conversations
   - `CLEAR_CONVERSATIONS` - Clears local storage

### 4. Popup UI (popup.html, popup.js, popup.css)

Simple settings and status interface.

**Features**:
- Conversation count display
- Last sync time (relative format)
- API configuration status
- Manual sync button
- Settings panel for API endpoint/key
- Clear data button

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude.ai Page                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             Content Script (content.js)               │   │
│  │  1. MutationObserver detects new messages            │   │
│  │  2. Extract conversation data from DOM               │   │
│  │  3. Save to chrome.storage.local                     │   │
│  │  4. Notify service worker                            │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              chrome.storage.local                           │
│  {                                                          │
│    conversations: {                                         │
│      "uuid-1": { id, title, messages, ... },               │
│      "uuid-2": { id, title, messages, ... }                │
│    }                                                        │
│  }                                                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Service Worker (service-worker.js)                  │
│  - Daily alarm triggers sync                                │
│  - POST /api/v1/conversations to backend                    │
│  - Bearer token authentication                              │
└─────────────────────────────────────────────────────────────┘
```

## Storage Schema

### chrome.storage.local

```javascript
{
  conversations: {
    "conversation-uuid": {
      id: "conversation-uuid",
      title: "Conversation Title",
      createdAt: "2025-12-02T10:00:00Z",
      updatedAt: "2025-12-02T10:30:00Z",
      messageCount: 10,
      messages: [
        {
          id: "msg-0",
          role: "user",
          content: "...",
          timestamp: "2025-12-02T10:00:00Z",
          sequenceNumber: 0
        },
        // ...
      ]
    }
  },
  lastSyncAt: "2025-12-02T10:00:00Z"
}
```

### chrome.storage.sync (Settings)

```javascript
{
  apiEndpoint: "http://localhost:3000/api/v1",
  apiKey: "your-api-key"
}
```

## DOM Parsing Strategy

Claude.ai may change their DOM structure. The content script uses a **fallback strategy**:

```javascript
const parsers = [
  // Strategy 1: data-testid attributes (most reliable)
  parseByTestId,

  // Strategy 2: Class-based selectors
  parseByClassNames,

  // Strategy 3: Generic prose blocks (nuclear fallback)
  parseByProse
];

for (const parser of parsers) {
  const result = parser(document);
  if (result.length > 0) return result;
}
```

**Current Selectors**:
- `[data-testid$="-message"]` - Message containers
- `[class*="ConversationTurn"]` - Turn containers
- `[class*="prose"]` - Prose blocks

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The extension should now appear in your extensions list

## Testing

1. Navigate to [claude.ai](https://claude.ai)
2. Open a conversation or start a new one
3. Check the browser console for `[Jarvis]` logs
4. Open the extension popup to see captured conversations
5. Configure API settings and test sync

## Known Limitations

1. **DOM Dependency**: If Claude.ai significantly changes their HTML structure, the parsers will need updating
2. **No Image Capture**: Currently only captures text content
3. **Timestamp Approximation**: Uses capture time, not actual message time (DOM doesn't expose exact times)
4. **Single Tab**: Only captures from the active Claude.ai tab

## Future Improvements

- [ ] Add placeholder icons (currently missing)
- [ ] Improve timestamp accuracy using DOM time elements
- [ ] Add image/artifact URL capture
- [ ] Add retry queue for failed syncs
- [ ] Add badge indicator for unsync'd conversations
