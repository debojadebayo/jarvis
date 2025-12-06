import { eq, inArray, and, lte, gte, isNull } from "drizzle-orm";
import { Database } from "../../infrastructure/db/index";
import { Conversation, conversationEmbeddings, conversations, NewConversation } from "../../infrastructure/db/schema";
import { DatabaseError } from "../../errors";



export class ConversationRepository {

    constructor(private db: Database){}

    async findByClaudeId(claudeConversationId: string): Promise<Conversation | null> {
        try {
            const results = await this.db
                .select()
                .from(conversations)
                .where(eq(conversations.claudeConversationId, claudeConversationId))
                .limit(1);
            return results[0] || null;
        } catch (error) {
            throw new DatabaseError('Failed to find conversation', { claudeConversationId, error });
        }
    }

    async create(conversation: NewConversation): Promise<Conversation> {
        try {
            const [newConversation] = await this.db
                .insert(conversations)
                .values(conversation)
                .returning();
            return newConversation;
        } catch (error) {
            throw new DatabaseError('Failed to create conversation', { conversation, error });
        }
    }

    async update(id: string, updates: Partial<Conversation>): Promise<Conversation> {
        try {
            const [updatedConversation] = await this.db
                .update(conversations)
                .set({...updates, updated_at: new Date()})
                .where(eq(conversations.id, id))
                .returning();
            return updatedConversation;
        } catch (error) {
            throw new DatabaseError('Failed to update conversation', { id, updates, error });
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.db
                .delete(conversations)
                .where(eq(conversations.id, id));
        } catch (error) {
            throw new DatabaseError('Failed to delete conversation', { id, error });
        }
    }

    async findByIds(conversationIds: string[]): Promise<Conversation[]>{
        try {
            const results = await this.db 
                .select()
                .from(conversations)
                .where(inArray(conversations.id, conversationIds))
            
            return results
        } catch (error) {
            throw new DatabaseError('Failed to find conversations', { conversationIds, error });
        }
    }

    async findByDateRange(from?: Date, to?: Date): Promise<Conversation[]>{
        try {
            if(!from && ! to){
                throw new Error ("At least one date parameter is required ")
            }

            const conditions = []

            if(from) conditions.push(gte(conversations.created_at, from))
            if(to) conditions.push(lte(conversations.created_at,to))

            const results = await this.db
                .select()
                .from(conversations)
                .where(conditions.length > 0 ? and(...conditions): undefined)
            
            return results 
        } catch (error) {
             throw new DatabaseError('Failed to find conversations by date', { error });
        }
    }

    async findConversationWithoutEmbeddings(): Promise<string[]>{
        try {
            const results = await this.db
                .select( {id: conversations.id})
                .from(conversations)
                .leftJoin(
                    conversationEmbeddings,
                    eq(conversations.id, conversationEmbeddings.conversationId)
                )
                .where(isNull(conversationEmbeddings.id))
            
            return results.map(r => r.id)
        } catch (error) {
            throw new DatabaseError('Failed to find outstanding conversations', { error })
        }
    }
}