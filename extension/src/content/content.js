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
let lastConversationId = null;
let debounceTimer = null;

function getConversationId() {
  const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function getConversationTitle() {
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
    const text = firstUserMessage.textContent?.trim().substring(0, 50);
    return text || 'Untitled Conversation';
  }

  return 'Untitled Conversation';
}

function extractMessages() {
  try {
    const allElements = document.querySelectorAll('[data-testid="user-message"], .standard-markdown');

    if (allElements.length === 0) {
      return [];
    }

    const messages = [];

    allElements.forEach((element, index) => {
      const isUser = element.getAttribute('data-testid') === 'user-message';
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
  } catch (error) {
    log.error('Error extracting messages:', error);
    return [];
  }
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
  try {
    const result = await chrome.storage.local.get(['conversations']);
    const conversations = result.conversations || {};

    const existing = conversations[conversation.id];
    if (existing) {
      conversation.createdAt = existing.createdAt;
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
    if (!conversation) return;

    // Reset count if conversation changed
    if (conversation.id !== lastConversationId) {
      lastCapturedMessageCount = 0;
      lastConversationId = conversation.id;
    }

    if (conversation.messageCount !== lastCapturedMessageCount) {
      lastCapturedMessageCount = conversation.messageCount;
      saveConversation(conversation);
    }
  }, config.DEBOUNCE_MS);
}

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    const isRelevant = mutations.some(mutation => {
      // Capture when streaming ends
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-is-streaming') {
        return mutation.target.getAttribute('data-is-streaming') === 'false';
      }
      if (mutation.addedNodes.length > 0) {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          return node.matches?.('[data-testid="user-message"], .standard-markdown') ||
                 node.querySelector?.('[data-testid="user-message"], .standard-markdown');
        });
      }
      return false;
    });

    if (isRelevant) {
      debouncedCapture();
    }
  });

  const targetNode = document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-is-streaming']
  });

  log.debug('Observer started');
}

function init() {
  log.info('Content script loaded');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupObserver();
      debouncedCapture();
    });
  } else {
    setupObserver();
    debouncedCapture();
  }
}

init();
