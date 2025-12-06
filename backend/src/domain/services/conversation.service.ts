import { IngestRequest } from "../../schemas/conversation.schema";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/messages.repository";
import { EmbeddingQueue } from "./embeddingqueue";
import { EmbeddingAdapter, VoyageAdapter } from "../../infrastructure/embedding-providers";
import { EmbeddingsRepository } from "../repositories/embeddings.repository";
import { ConversationWithMessages } from "../../types";
import { configDotenv } from "dotenv";

interface ConversationUpsertMetrics {
    processed: number;
    created: number;
    updated: number;
}

export class ConversationService {

    private embeddingQueue = EmbeddingQueue.getInstance();


    constructor(
        private conversationRepository: ConversationRepository,
        private messageRepository: MessageRepository,
        private embeddingsRepository: EmbeddingsRepository,
        private embeddingClient: EmbeddingAdapter = new VoyageAdapter(process.env.VOYAGEAI_API_KEY || "") 

    ) {}

    async upsertConversations(convs: IngestRequest): Promise<ConversationUpsertMetrics> {
        let processed = 0;
        let created = 0;
        let updated = 0;

        for (const conv of convs.conversations) {
            const existingConversation = await this.conversationRepository.findByClaudeId(conv.id);

            if (existingConversation) {
                if (conv.messages.length === existingConversation.messageCount) {
                    continue;
                }

                await this.conversationRepository.update(existingConversation.id, {
                    title: conv.title,
                    messageCount: conv.messages.length,
                });

                const messageData = conv.messages.map((msg, index) => ({
                    conversationId: existingConversation.id,
                    sequence_number: index,
                    role: msg.role,
                    content: msg.content,
                    created_at: new Date(msg.timestamp),
                }));
                await this.messageRepository.upsertMessages(messageData);

                this.embeddingQueue.add(existingConversation.id);

                updated += 1;
                processed += 1;
            } else {
                const newConv = await this.conversationRepository.create({
                    claudeConversationId: conv.id,
                    title: conv.title,
                    messageCount: conv.messages.length,
                    created_at: new Date(conv.created_at),
                });

                const messageData = conv.messages.map((msg, index) => ({
                    conversationId: newConv.id,
                    sequence_number: index,
                    role: msg.role,
                    content: msg.content,
                    created_at: new Date(msg.timestamp),
                }));
                await this.messageRepository.upsertMessages(messageData);

                this.embeddingQueue.add(newConv.id);
                created += 1;
                processed += 1;
            }
        }

        return { processed, created, updated };
    }

    async searchConversations(query:string): Promise<ConversationWithMessages[]>{

        const queryEmbedding = await this.generateQueryEmbedding(query)
        const convEmbeddings = await this.embeddingsRepository.compareEmbeddings(queryEmbedding)

        const ids = convEmbeddings.map(conv => conv.conversationId)
        
        const convMetaData = await this.conversationRepository.findByIds(ids)
        const messages = await this.messageRepository.findByConversationIds(ids)

        const result = convMetaData.map(conv => {
            const convMessages = messages.filter(msg => msg.conversationId === conv.id);

            return {
                id: conv.id, 
                title: conv.title,
                created_at: conv.created_at, 
                updated_at: conv.updated_at,
                messageCount: conv.messageCount,
                messages: convMessages
            }
        })

        return result

    }

    private async generateQueryEmbedding(query: string): Promise<number[]> {
            return this.embeddingClient.embed(query);
    }

    async getConversationsByDateRange(from?: string, to?: string): Promise<ConversationWithMessages[]>{
        const convs = await this.conversationRepository.findByDateRange(
            from ? new Date(from): undefined, 
            to ? new Date(to): undefined
        )
        const ids = convs.map(conv=>conv.id)
        const messages = await this.messageRepository.findByConversationIds(ids)

        const result = convs.map(conv => {
            const convMessages = messages.filter(msg => msg.conversationId === conv.id)

            return {
                id: conv.id, 
                title: conv.title,
                created_at: conv.created_at, 
                updated_at: conv.updated_at,
                messageCount: conv.messageCount,
                messages: convMessages
            }
        })

        return result 
    }


}