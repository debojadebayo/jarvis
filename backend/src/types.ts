import { Message } from "./infrastructure/db/schema"

export interface ConversationWithMessages {
    id: string, 
    title: string, 
    created_at: Date;
    updated_at: Date;
    messageCount: number; 
    messages: Message[] 
}
