import { log } from '../lib/logger.js';

const SYNC_ALARM_NAME = 'jarvis-daily-sync';
const DEFAULT_API_ENDPOINT = 'http://localhost:3000/api/v1';

async function initialize() {
  log.info('Service worker initialized');
  await setupDailySyncAlarm();
  const settings = await chrome.storage.sync.get(['apiEndpoint', 'apiKey']);
  if (!settings.apiEndpoint) {
    await chrome.storage.sync.set({ apiEndpoint: DEFAULT_API_ENDPOINT });
  }
}

async function setupDailySyncAlarm() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);

  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: 24 * 60, 
    delayInMinutes: 1 
  });
}

async function getStoredConversations() {
  const result = await chrome.storage.local.get(['conversations']);
  return result.conversations || {};
}

async function getSettings() {
  const settings = await chrome.storage.sync.get(['apiEndpoint', 'apiKey']);
  return {
    apiEndpoint: settings.apiEndpoint || DEFAULT_API_ENDPOINT,
    apiKey: settings.apiKey || ''
  };
}

async function syncToBackend() {
  log.info('Starting sync to backend...');

  const settings = await getSettings();
  if (!settings.apiKey) {
    log.warn('No API key configured, skipping sync');
    return { success: false, error: 'No API key configured' };
  }

  const conversations = await getStoredConversations();
  const conversationList = Object.values(conversations);

  if (conversationList.length === 0) {
    log.debug('No conversations to sync');
    return { success: true, synced: 0 };
  }

  try {
    const response = await fetch(`${settings.apiEndpoint}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({ conversations: conversationList })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Update last sync time
    await chrome.storage.local.set({ lastSyncAt: new Date().toISOString() });

    log.info(`Synced ${conversationList.length} conversations`);
    return { success: true, synced: conversationList.length };
  } catch (error) {
    log.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}


async function getSyncStatus() {
  const conversations = await getStoredConversations();
  const result = await chrome.storage.local.get(['lastSyncAt']);
  const settings = await getSettings();

  return {
    conversationCount: Object.keys(conversations).length,
    lastSyncAt: result.lastSyncAt || null,
    apiConfigured: !!settings.apiKey,
    apiEndpoint: settings.apiEndpoint
  };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    log.info('Daily sync alarm triggered');
    syncToBackend();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log.debug('Received message:', message.type);

  switch (message.type) {
    case 'CONVERSATION_UPDATED':
      log.debug(`Conversation updated: ${message.conversationId}`);
      break;

    case 'GET_STATUS':
      getSyncStatus().then(sendResponse);
      return true; 

    case 'TRIGGER_SYNC':
      syncToBackend().then(sendResponse);
      return true;

    case 'GET_CONVERSATIONS':
      getStoredConversations().then(sendResponse);
      return true;

    case 'CLEAR_CONVERSATIONS':
      chrome.storage.local.set({ conversations: {} }).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  log.info('Extension installed');
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  log.info('Extension started');
  initialize();
});

initialize();
