import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../../config/env";

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const authHeader = request.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        reply.status(401).send({ error: 'Unauthorized' });
        return;
    }

    const token = authHeader.substring(7);

    if(token !== env.API_KEY){
        reply.status(403).send({ error: 'Forbidden' });
        return;
    }

    request.authenticated = true;
}

declare module 'fastify' {
    interface FastifyRequest {
        authenticated?: boolean;
    }
}