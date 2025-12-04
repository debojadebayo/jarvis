import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index";
import { messages, Message, NewMessage } from "../../infrastructure/db/schema";


export class MessageRepository {
    async upsertMessages(messageData: NewMessage[]): Promise<void> {
        for (const message of messageData) {
            await db.insert(messages)
            .values(message)
            .onConflictDoUpdate({
                target: [messages.conversationId, messages.sequence_number],
                set: { content: message.content, timestamp: message.timestamp },
            });
        }
    }

    async findbyConversationId(conversationId: string): Promise<Message[]> {
        return db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(messages.sequence_number);
    }

}