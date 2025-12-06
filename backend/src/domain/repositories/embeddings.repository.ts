import { eq } from "drizzle-orm";
import { Database } from "../../infrastructure/db/index";
import { conversationEmbeddings, ConversationEmbedding, NewConversationEmbedding} from "../../infrastructure/db/schema";
import { DatabaseError } from "../../errors";
import { sql } from "drizzle-orm";

export class EmbeddingsRepository {

    constructor(private db: Database){}

    async create(embeddingData: NewConversationEmbedding): Promise<ConversationEmbedding> {
        try {
            const [newEmbedding] = await this.db
                .insert(conversationEmbeddings)
                .values(embeddingData)
                .returning();
            return newEmbedding;
        } catch (error) {
            throw new DatabaseError('Failed to create embedding', { embeddingData, error });
        }
    }

    async findByConversationId(conversationId: string): Promise<ConversationEmbedding | null> {
        try {
            const results = await this.db
                .select()
                .from(conversationEmbeddings)
                .where(eq(conversationEmbeddings.conversationId, conversationId))
                .limit(1);
            return results[0] || null;
        } catch (error) {
            throw new DatabaseError('Failed to find embedding', { conversationId, error });
        }
    }

    async upsert(conversationId: string, embedding: number[]): Promise<ConversationEmbedding> {
        try {
            const [result] = await this.db
                .insert(conversationEmbeddings)
                .values({ conversationId, embedding })
                .onConflictDoUpdate({
                    target: [conversationEmbeddings.conversationId],
                    set: { embedding, created_at: new Date() },
                })
                .returning();
            return result;
        } catch (error) {
            throw new DatabaseError('Failed to upsert embedding', { conversationId, error });
        }
    }

    async compareEmbeddings(queryEmbedding: number[]): Promise<ConversationEmbedding[]> {
        try {
            const vectorString = JSON.stringify(queryEmbedding)
            const results = await this.db
                .select()
                .from(conversationEmbeddings)
                .orderBy(sql`${conversationEmbeddings.embedding} <=> ${vectorString}::vector`)
                .limit(5);

            if(results.length === 0){
                throw new Error("no conversations retrieved")
            }
            
            return results     
        } catch (error) {
            throw new DatabaseError('Failed to compare embeddings', { queryEmbedding, error })
        }
    }
}