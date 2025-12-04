import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index";
import { Conversation, conversations, NewConversation } from "../../infrastructure/db/schema";


//should create DI here later for proper testing 
export class ConversationRepository {
    async findByClaudeId(claudeConversationId: string): Promise<Conversation | null> {
        const results = await db
            .select()
            .from(conversations)
            .where(eq(conversations.claudeConversationId, claudeConversationId))
            .limit(1);
        return results[0] || null;
    }

    async create(conversation: NewConversation): Promise<Conversation> {
        const [newConversation] = await db
            .insert(conversations)
            .values(conversation)
            .returning();
        return newConversation;
    }

    async update(id: string, updates: Partial<Conversation>): Promise<Conversation> {
        const [updatedConversation] = await db
            .update(conversations)
            .set(updates)
            .where(eq(conversations.id, id))
            .returning();
        return updatedConversation;
    }

    async delete(id: string): Promise<void> {
        await db
            .delete(conversations)
            .where(eq(conversations.id, id));
    }
}