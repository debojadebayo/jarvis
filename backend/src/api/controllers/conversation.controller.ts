import { FastifyRequest, FastifyReply } from "fastify";
import { IngestRequest, SearchRequest } from "../../schemas/conversation.schema";
import { ConversationService } from "../../domain/services/conversation.service";


export class ConversationController {
    constructor(private conversationService: ConversationService) {}

    async ingest(
        request: FastifyRequest<{ Body: IngestRequest }>,
        reply: FastifyReply
    ){
        const result = await this.conversationService.upsertConversations(request.body);

        return reply.status(200).send({ 
            success: true,
            processed: result.processed,
            created: result.created,
            updated:  result.updated,
            });
    }

    async search(
        request: FastifyRequest<{ Querystring: SearchRequest }>,
        reply: FastifyReply
    ){
        const result = await this.conversationService.searchConversations(request.query);
        return reply.status(200).send({
            success: true,
            data: result
        });
    }
}