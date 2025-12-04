import { FastifyRequest, FastifyReply } from "fastify";
import { IngestRequest } from "../schemas/conversation.schema";


export class ConversationController {
    constructor(private conversationService: any) {}

    async ingest(
        request: FastifyRequest<{ Body: IngestRequest }>,
        reply: FastifyReply
    ){
        const result = await this.conversationService.upsertConversations(request.body.conversations);

    return reply.status(200).send({ 
        success: true,
        processed: result.processed,
        created: result.created,
        updated:  result.updated,
        });
    }
}