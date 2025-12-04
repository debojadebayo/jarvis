import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index";
import { conversationEmbeddings, ConversationEmbedding, NewConversationEmbedding} from "../../infrastructure/db/schema";

export class EmbeddingsRepository {
    async create(embeddingData: NewConversationEmbedding): Promise<ConversationEmbedding> {
        const [newEmbedding] = await db
            .insert(conversationEmbeddings)
            .values(embeddingData)
            .returning();
        return newEmbedding;
    }

    async findByConversationId(conversationId: string): Promise<ConversationEmbedding | null> {
        const results =  await db
            .select()
            .from(conversationEmbeddings)
            .where(eq(conversationEmbeddings.conversationId, conversationId))
            .limit(1);
        return results[0] || null;
    }

    async upsert(conversationId: string, embedding: number[]): Promise<ConversationEmbedding> {
        const [result] = await db
            .insert(conversationEmbeddings)
            .values({ conversationId, embedding })
            .onConflictDoUpdate({
                target: [conversationEmbeddings.conversationId],
                set: { embedding, timestamp: new Date() },
            })
            .returning();
        return result;
    }
}