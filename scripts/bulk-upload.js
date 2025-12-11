#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_ENDPOINT = process.env.API_ENDPOINT || 'http://46.224.116.241:3000/api/v1';
const API_KEY = process.env.API_KEY;
const BATCH_SIZE = 100; // Max per API schema

// Warn if using HTTP instead of HTTPS
if (API_ENDPOINT.startsWith('http://')) {
  console.warn('⚠️  WARNING: Using HTTP instead of HTTPS - your data will be transmitted unencrypted!');
  console.warn('⚠️  Consider setting up HTTPS for production use.\n');
}

if (!API_KEY) {
  console.error('❌ Error: API_KEY environment variable is required');
  console.error('Usage: API_KEY=your-key node scripts/bulk-upload.js');
  process.exit(1);
}

function transformClaudeExportToApiFormat(claudeConversations) {
  return claudeConversations.map(conv => {
    const messages = conv.chat_messages.map((msg, index) => ({
      role: msg.sender === 'human' ? 'user' : 'assistant',
      content: msg.text || msg.content?.[0]?.text || '',
      timestamp: msg.created_at
    }));

    return {
      id: conv.uuid,
      title: conv.name || 'Untitled Conversation',
      created_at: conv.created_at,
      messages: messages
    };
  });
}

async function uploadBatch(conversations, batchNumber) {
  console.log(`📤 Uploading batch ${batchNumber} (${conversations.length} conversations)...`);

  try {
    const response = await fetch(`${API_ENDPOINT}/conversations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ conversations })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Batch ${batchNumber} uploaded successfully`);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Batch ${batchNumber} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting bulk upload of Claude.ai conversations\n');

  // Read the conversations file
  const dataPath = path.join(__dirname, '../data/conversations.json');
  console.log(`📖 Reading ${dataPath}...`);

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const claudeConversations = JSON.parse(rawData);

  console.log(`📊 Found ${claudeConversations.length} conversations\n`);

  // Transform to API format
  console.log('🔄 Transforming conversations to API format...');
  const apiConversations = transformClaudeExportToApiFormat(claudeConversations);

  // Filter out conversations with no messages
  const validConversations = apiConversations.filter(conv => conv.messages.length > 0);
  console.log(`✅ ${validConversations.length} valid conversations (${apiConversations.length - validConversations.length} skipped - no messages)\n`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < validConversations.length; i += BATCH_SIZE) {
    batches.push(validConversations.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Split into ${batches.length} batches of ${BATCH_SIZE} conversations\n`);

  // Upload batches
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const result = await uploadBatch(batches[i], i + 1);
    if (result.success) {
      successCount += batches[i].length;
    } else {
      failureCount += batches[i].length;
    }

    // Add a small delay between batches to avoid overwhelming the server
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Upload Summary:');
  console.log(`   Total conversations: ${validConversations.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log('='.repeat(50));
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
