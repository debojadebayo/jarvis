import { log } from '../lib/logger.js';

// DOM Elements
const conversationCountEl = document.getElementById('conversation-count');
const lastSyncEl = document.getElementById('last-sync');
const apiStatusEl = document.getElementById('api-status');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const apiEndpointInput = document.getElementById('api-endpoint');
const apiKeyInput = document.getElementById('api-key');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const clearBtn = document.getElementById('clear-btn');

function formatDate(isoDate) {
  if (!isoDate) return 'Never';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60 * 1000);
  const diffHours = Math.floor(diffMs / 60 * 60 * 1000);
  const diffDays = Math.floor(diffMs / 24 * 60 * 60 * 1000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

async function loadStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    conversationCountEl.textContent = status.conversationCount;
    lastSyncEl.textContent = formatDate(status.lastSyncAt);

    if (status.apiConfigured) {
      apiStatusEl.textContent = 'Configured';
      apiStatusEl.className = 'value success';
    } else {
      apiStatusEl.textContent = 'Not configured';
      apiStatusEl.className = 'value warning';
    }
  } catch (error) {
    log.error('Failed to load status:', error);
  }
}


async function loadSettings() {
  const settings = await chrome.storage.sync.get(['apiEndpoint', 'apiKey']);
  apiEndpointInput.value = settings.apiEndpoint || 'http://46.224.116.241:3000/api/v1';
  apiKeyInput.value = settings.apiKey || '';
}


async function saveSettings() {
  const apiEndpoint = apiEndpointInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  await chrome.storage.sync.set({ apiEndpoint, apiKey });

  settingsPanel.classList.add('hidden');
  loadStatus();
}

async function triggerSync() {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  syncBtn.classList.add('loading');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });

    if (result.success) {
      syncBtn.textContent = `Synced ${result.synced}!`;
      setTimeout(() => {
        syncBtn.textContent = 'Sync Now';
        syncBtn.disabled = false;
        syncBtn.classList.remove('loading');
      }, 2000);
    } else {
      syncBtn.textContent = 'Failed';
      log.error('Sync failed:', result.error);
      setTimeout(() => {
        syncBtn.textContent = 'Sync Now';
        syncBtn.disabled = false;
        syncBtn.classList.remove('loading');
      }, 2000);
    }

    loadStatus();
  } catch (error) {
    log.error('Sync error:', error);
    syncBtn.textContent = 'Error';
    setTimeout(() => {
      syncBtn.textContent = 'Sync Now';
      syncBtn.disabled = false;
      syncBtn.classList.remove('loading');
    }, 2000);
  }
}

async function clearData() {
  if (!confirm('Are you sure you want to clear all locally stored conversations? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATIONS' });
    loadStatus();
  } catch (error) {
    log.error('Failed to clear data:', error);
  }
}

syncBtn.addEventListener('click', triggerSync);

settingsBtn.addEventListener('click', () => {
  loadSettings();
  settingsPanel.classList.toggle('hidden');
});

saveSettingsBtn.addEventListener('click', saveSettings);

cancelSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

clearBtn.addEventListener('click', clearData);

document.addEventListener('DOMContentLoaded', loadStatus);
