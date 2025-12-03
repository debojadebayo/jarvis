/**
 * @typedef {Object} Message
 * @property {string} id - Unique message ID
 * @property {'user' | 'assistant'} role - Who sent the message
 * @property {string} content - Message content
 * @property {string} timestamp - ISO timestamp
 * @property {number} sequenceNumber - Order in conversation
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id - Claude's conversation ID (from URL)
 * @property {string} title - Conversation title
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {Message[]} messages - Array of messages
 * @property {number} messageCount - Total message count
 */

/**
 * @typedef {Object} StorageData
 * @property {Object.<string, Conversation>} conversations - Map of conversation ID to conversation
 * @property {string} lastSyncAt - ISO timestamp of last sync to backend
 * @property {string} apiEndpoint - Backend API endpoint
 * @property {string} apiKey - API key for authentication
 */

export {};
