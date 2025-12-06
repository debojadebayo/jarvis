import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { conversationController } from "../../dependencies";
import { 
    ingestRequestSchema, 
    IngestRequest, 
    searchRequestSchema, 
    SearchRequest,
    dateRangeRequestSchema, 
    DateRangeRequest
} from "../../schemas/conversation.schema";


export async function conversationRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
    fastify.post<{ Body: IngestRequest }>('/conversations/', { preHandler: [ authenticate, validate(ingestRequestSchema, 'body')]}, 
    conversationController.ingest.bind(conversationController));
    fastify.get<{ Querystring: SearchRequest }> ('/conversations/search', { preHandler: [ authenticate , validate(searchRequestSchema,'query')]},
    conversationController.search.bind(conversationController));
    fastify.get<{ Querystring: DateRangeRequest }> ('/conversations/date-range', { preHandler: [ authenticate, validate(dateRangeRequestSchema, 'query')]},
    conversationController.dateRange.bind(conversationController))
}