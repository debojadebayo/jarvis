import { FastifyRequest, FastifyReply } from "fastify";

export class HealthController {
    async checkHealth(_request: FastifyRequest, reply: FastifyReply) {
        return reply.status(200).send({ status: "ok" });
    }   
}