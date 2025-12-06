import { ConversationRepository } from "./domain/repositories/conversation.repository";
import { MessageRepository } from "./domain/repositories/messages.repository";
import { EmbeddingsRepository } from "./domain/repositories/embeddings.repository";
import { ConversationService } from "./domain/services/conversation.service";
import { EmbeddingQueue } from "./domain/services/embeddingqueue";
import { ConversationController } from "./api/controllers/conversation.controller";
import { HealthController } from "./api/controllers/health.controllers";
import { EmbeddingAdapter, VoyageAdapter } from "./infrastructure/embedding-providers";
import { db } from "./infrastructure/db/index"
import { EmbeddingService } from "./domain/services/embedding.service";


//infra
export const embeddingsClient:EmbeddingAdapter = new VoyageAdapter(process.env.VOYAGEAI_API_KEY || "")
export const embeddingQueue = EmbeddingQueue.getInstance();
export { db }


//repositories
export const conversationRepository = new ConversationRepository(db);
export const messageRepository = new MessageRepository(db);
export const embeddingsRepository = new EmbeddingsRepository(db)

//services 
export const conversationService = new ConversationService(
    conversationRepository,
    messageRepository,
    embeddingsRepository, 
    embeddingsClient,
    embeddingQueue
);

export const embeddingService = new EmbeddingService(
    messageRepository,
    embeddingsRepository,
    embeddingsClient, 
    embeddingQueue
)

//conversation controllers
export const conversationController = new ConversationController(conversationService);
export const healthController = new HealthController()