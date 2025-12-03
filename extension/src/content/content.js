// Logger (inline - content scripts can't use ES module imports)
function isDevelopment() {
  try {
    const manifest = chrome.runtime.getManifest();
    return !('update_url' in manifest);
  } catch {
    return true;
  }
}
const LOG_LEVEL = isDevelopment() ? 'debug' : 'warn';
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
const log = {
  debug: (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.debug && console.log('[Jarvis]', ...args),
  info:  (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.info && console.info('[Jarvis]', ...args),
  warn:  (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.warn && console.warn('[Jarvis]', ...args),
  error: (...args) => LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.error && console.error('[Jarvis]', ...args),
};

// Configuration
const config = {
  CAPTURE_INTERVAL_MS: 5000,
  DEBOUNCE_MS: 1000,
};

// State
let lastCapturedMessageCount = 0;
let debounceTimer = null;

function getConversationId() {
  const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function getConversationTitle() {
  // Try multiple selectors for robustness
  const selectors = [
    '[data-testid="chat-title-button"]',
    'title',
    'h1',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent?.trim();
      if (text && text !== 'Claude' && !text.includes('Claude')) {
        return text;
      }
    }
  }

  // Fallback: use first user message as title
  const firstUserMessage = document.querySelector('[data-testid="user-message"]');
  if (firstUserMessage) {
    const text = firstUserMessage.textContent?.trim().substring(0, 100);
    return text || 'Untitled Conversation';
  }

  return 'Untitled Conversation';
}

function extractMessages() {
  const messages = [];
  const userMessages = document.querySelectorAll('[data-testid="user-message"]');

  if (userMessages.length > 0) {
    // Get all message elements in DOM order
    const allElements = document.querySelectorAll('[data-testid="user-message"], .standard-markdown');

    allElements.forEach((element, index) => {
      const isUser = element.hasAttribute('data-testid') &&
                     element.getAttribute('data-testid') === 'user-message';
      const content = extractMessageContent(element);

      if (content) {
        messages.push({
          id: `msg-${index}`,
          role: isUser ? 'user' : 'assistant',
          content,
          timestamp: new Date().toISOString(),
          sequenceNumber: index
        });
      }
    });

    return messages;
  }

  log.debug('No messages found with primary selectors');
  return messages;
}

function extractMessageContent(container) {
  // Clone to avoid modifying the DOM
  const clone = container.cloneNode(true);

  // Remove any UI elements we don't want
  const removeSelectors = ['button', '[class*="copy"]', '[class*="action"]', 'svg'];
  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Preserve code blocks with formatting
  clone.querySelectorAll('pre, code').forEach(codeEl => {
    const text = codeEl.textContent;
    if (codeEl.tagName === 'PRE') {
      codeEl.textContent = '\n```\n' + text + '\n```\n';
    }
  });

  return clone.textContent?.trim() || '';
}

function captureConversation() {
  const conversationId = getConversationId();
  if (!conversationId) {
    log.debug('No conversation ID found');
    return null;
  }

  const messages = extractMessages();
  if (messages.length === 0) {
    log.debug('No messages found');
    return null;
  }

  const conversation = {
    id: conversationId,
    title: getConversationTitle(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages,
    messageCount: messages.length
  };

  log.info(`Captured conversation: ${conversation.title} (${messages.length} messages)`);
  return conversation;
}

async function saveConversation(conversation) {
  if (!conversation) return;

  try {
    const result = await chrome.storage.local.get(['conversations']);
    const conversations = result.conversations || {};

    // Update or insert
    const existing = conversations[conversation.id];
    if (existing) {
      conversation.createdAt = existing.createdAt; // Preserve original creation time
    }

    conversations[conversation.id] = conversation;

    await chrome.storage.local.set({ conversations });
    log.debug(`Saved conversation ${conversation.id}`);

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'CONVERSATION_UPDATED',
      conversationId: conversation.id,
      messageCount: conversation.messageCount
    });
  } catch (error) {
    log.error('Error saving conversation:', error);
  }
}

function debouncedCapture() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const conversation = captureConversation();
    if (conversation && conversation.messageCount !== lastCapturedMessageCount) {
      lastCapturedMessageCount = conversation.messageCount;
      saveConversation(conversation);
    }
  }, config.DEBOUNCE_MS);
}

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if any mutation is relevant (new messages added)
    const isRelevant = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 ||
             mutation.type === 'characterData';
    });

    if (isRelevant) {
      debouncedCapture();
    }
  });

  // Observe the main content area
  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    characterData: true
  });

  log.debug('Observer started');
}

function init() {
  log.info('Content script loaded');

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupObserver();
      debouncedCapture();
    });
  } else {
    setupObserver();
    debouncedCapture();
  }

  // Also capture on URL changes (SPA navigation)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      lastCapturedMessageCount = 0; // Reset for new conversation
      debouncedCapture();
    }
  }, 1000);
}

// Start
init();
