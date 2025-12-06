import { ConversationRepository } from "./domain/repositories/conversation.repository";
import { MessageRepository } from "./domain/repositories/messages.repository";
import { ConversationService } from "./domain/services/conversation.service";
import { ConversationController } from "./api/controllers/conversation.controller";
import { HealthController } from "./api/controllers/health.controllers";
import { EmbeddingsRepository } from "./domain/repositories/embeddings.repository";
import { EmbeddingAdapter, VoyageAdapter } from "./infrastructure/embedding-providers";

export const conversationRepository = new ConversationRepository();
export const messageRepository = new MessageRepository();
export const embeddingsRepository = new EmbeddingsRepository()
export const embeddingsClient:EmbeddingAdapter = new VoyageAdapter(process.env.VOYAGEAI_API_KEY || "") 



//services 

export const conversationService = new ConversationService(
    conversationRepository,
    messageRepository,
    embeddingsRepository, 
    embeddingsClient
);

//conversation controllers
export const conversationController = new ConversationController(
    conversationService
);

export const healthController = new HealthController()