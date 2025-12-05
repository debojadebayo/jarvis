import { IngestRequest } from "../../schemas/conversation.schema";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/messages.repository";
import { EmbeddingQueue } from "./embeddingqueue";

interface ConversationUpsertMetrics {
    processed: number;
    created: number;
    updated: number;
}

export class ConversationService {

    private embeddingQueue = EmbeddingQueue.getInstance();


    constructor(
        private conversationRepository: ConversationRepository,
        private messageRepository: MessageRepository  

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
}