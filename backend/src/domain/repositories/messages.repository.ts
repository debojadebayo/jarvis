import { eq, inArray } from "drizzle-orm";
import { Database } from "../../infrastructure/db/index";
import { messages, Message, NewMessage } from "../../infrastructure/db/schema";
import { DatabaseError } from "../../errors";


export class MessageRepository {

    constructor(private db: Database){}
    async upsertMessages(messageData: NewMessage[]): Promise<void> {
        try {

            for (const message of messageData) {
                await this.db.insert(messages)
                .values(message)
                .onConflictDoUpdate({
                    target: [messages.conversationId, messages.sequence_number],
                    set: { content: message.content, created_at: message.created_at },
                });
            }

        } catch (error) {
            throw new DatabaseError('Failed to upsert messages', { messageData, error } );
        }
    }

    async findByConversationId(conversationId: string): Promise<Message[]> {
        try {
            return this.db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, conversationId))
                .orderBy(messages.sequence_number);
            
        } catch (error) {
            throw new DatabaseError('Failed to retrieve messages', { conversationId, error } );
        }
    }

    async findByConversationIds(conversationIds: string[]): Promise<Message[]> {
        try {
            return this.db
                .select()
                .from(messages)
                .where(inArray(messages.conversationId, conversationIds))
                .orderBy(messages.sequence_number);
            
        } catch (error) {
            throw new DatabaseError('Failed to retrieve messages', { conversationIds, error } );
        }
    }


}