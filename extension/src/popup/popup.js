/**
 * Popup script for Jarvis Chrome Extension
 */
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

/**
 * Format a date for display
 * @param {string | null} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return 'Never';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Load and display current status
 */
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

/**
 * Load settings into form
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get(['apiEndpoint', 'apiKey']);
  apiEndpointInput.value = settings.apiEndpoint || 'http://localhost:3000/api/v1';
  apiKeyInput.value = settings.apiKey || '';
}

/**
 * Save settings
 */
async function saveSettings() {
  const apiEndpoint = apiEndpointInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  await chrome.storage.sync.set({ apiEndpoint, apiKey });

  settingsPanel.classList.add('hidden');
  loadStatus();
}

/**
 * Trigger manual sync
 */
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

/**
 * Clear all local data
 */
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

// Event Listeners
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

// Initialize
document.addEventListener('DOMContentLoaded', loadStatus);
