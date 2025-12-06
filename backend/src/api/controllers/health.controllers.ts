import { FastifyRequest, FastifyReply } from "fastify";
import { testConnection } from "../../infrastructure/db";

export class HealthController {
    async checkHealth(_request: FastifyRequest, reply: FastifyReply) {
        return reply.status(200).send({ status: "ok" });
    }

    async checkDbHealth(_request: FastifyRequest, reply: FastifyReply){
        const isConnected = await testConnection()

        if(!isConnected){

            return reply.status(503).send({ 
                status: "Degraded", 
                database: "Disconnected"
             });
        }

        return reply.status(200).send({
            status: "Ok",
            database: "Connected"
        })
        
    }
}