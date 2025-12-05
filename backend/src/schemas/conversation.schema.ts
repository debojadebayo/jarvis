import { z } from 'zod';


export const messageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1, 'Message content cannot be empty'),
    timestamp: z.string().datetime({ message: 'Invalid timestamp format' }),
});

export const conversationSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1, 'Conversation title cannot be empty').max(255, 'Conversation title cannot exceed 255 characters'),
    created_at: z.string().datetime({ message: 'Invalid creation date format' }),
    messages: z.array(messageSchema).min(1, 'Conversation must have at least one message'),
});

export const ingestRequestSchema = z.object({
    conversations: z.array(conversationSchema).min(1, 'At least one conversation is required for ingestion').max(100, 'A maximum of 100 conversations can be ingested at once'),
});

export const searchRequestSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty').max(500, 'Search query cannot exceed 500 characters'),
    limit: z.number().min(1).max(100).optional().default(10),
    from: z.string().datetime({ message: 'Invalid from date format' }).optional(),
    to: z.string().datetime({ message: 'Invalid to date format' }).optional(),
});


export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type ConversationInput = z.infer<typeof conversationSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
