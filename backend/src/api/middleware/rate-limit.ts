import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";


export async function registerRateLimit(app: FastifyInstance){
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '15 minutes',
        errorResponseBuilder: (_request, context) => ({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${context.after}`,
            statusCode: 429,
        }),
    });
}