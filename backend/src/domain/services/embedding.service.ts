import { EmbeddingQueue } from "./embeddingqueue"
import { MessageRepository } from "../repositories/messages.repository";
import { EmbeddingAdapter } from "../../infrastructure/embedding-providers"; 
import { Message } from "../../infrastructure/db/schema";
import { EmbeddingsRepository } from "../repositories/embeddings.repository";

export class EmbeddingService {

    constructor(
        private messageRepository: MessageRepository,
        private embeddingsRepository: EmbeddingsRepository,
        private embeddingClient: EmbeddingAdapter,
        private embeddingQueue: EmbeddingQueue,
    ){}

    async processNextConversation(): Promise<void> {
        const conversationId = this.embeddingQueue.processNext();
        if(!conversationId) return;

        const messages = await this.getMessages(conversationId)
        if(messages.length === 0) {
            throw new Error(`No messages found for conversation ID: ${conversationId}`)
        };
        const embeddings = await this.generateEmbeddings(messages);
        await this.saveEmbeddings(conversationId, embeddings);
    }

    private async getMessages(conversationId: string): Promise<Message[]> {
        return this.messageRepository.findByConversationId(conversationId);
    }
    private async generateEmbeddings(messages: Message[]): Promise<number[]> {
        const combinedText = messages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
        return this.embeddingClient.embed(combinedText);
    }

    private async saveEmbeddings(conversationId: string, embeddings: number[]): Promise<void> {
        await this.embeddingsRepository.upsert(conversationId, embeddings);
    }
}