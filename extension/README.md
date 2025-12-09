# Jarvis Chrome Extension

Chrome extension that captures your Claude.ai conversations and syncs them to the Jarvis backend for indexing and search.

## Features

- Automatically captures conversations from Claude.ai
- Daily automatic sync to backend
- Manual sync via popup
- Configurable API endpoint and key

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project

### Configure the Extension

1. Click the Jarvis extension icon in your browser toolbar
2. Click **Settings**
3. Enter your backend API endpoint (e.g., `http://localhost:3000/api/v1`)
4. Enter your API key (from your `.env` file)
5. Click **Save**

## Usage

- **Sync Now** - Manually trigger a sync of captured conversations
- **Settings** - Configure API endpoint and key
- **Clear Local Data** - Remove all locally stored conversations

The extension automatically syncs daily. Conversations are captured as you browse Claude.ai.

## Structure

```
extension/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons
└── src/
    ├── background/
    │   └── service-worker.js   # Background sync & messaging
    ├── content/
    │   └── content.js          # Captures conversations from Claude.ai
    ├── popup/
    │   ├── popup.html          # Extension popup UI
    │   ├── popup.css           # Popup styles
    │   └── popup.js            # Popup logic
    ├── lib/
    │   └── logger.js           # Logging utility
    └── types/
        └── types.js            # Type definitions
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store conversations locally and sync settings |
| `alarms` | Schedule daily automatic sync |
| `activeTab` | Access current tab for conversation capture |
| `host_permissions: claude.ai` | Read conversation data from Claude.ai |
