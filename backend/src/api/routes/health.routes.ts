import { FastifyInstance } from "fastify";
import { healthController } from "../../dependencies";

export async function healthRoutes(fastify:FastifyInstance, _options: any){
    fastify.get('/health', healthController.checkHealth.bind(healthController))
    fastify.get('/dbhealth', healthController.checkDbHealth.bind(healthController))

}