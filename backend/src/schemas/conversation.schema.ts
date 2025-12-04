import { z } from 'zod';


export const messageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1, 'Message content cannot be empty'),
    timestamp: z.string().datetime({ message: 'Invalid timestamp format' }),
});

export const conversationSchema = z.object({
    id: z.string().min(1),
    title: z.string().nullable().optional(),
    created_at: z.string().datetime({ message: 'Invalid creation date format' }),
    messages: z.array(messageSchema).min(1, 'Conversation must have at least one message'),
});

export const ingestRequestSchema = z.object({
    conversations: z.array(conversationSchema).min(1, 'At least one conversation is required for ingestion').max(100, 'A maximum of 100 conversations can be ingested at once'),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type ConversationInput = z.infer<typeof conversationSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
