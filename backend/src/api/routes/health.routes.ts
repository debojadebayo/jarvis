import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { healthController } from "../../dependencies";

export async function healthRoutes(fastify:FastifyInstance, _options: FastifyPluginOptions){
    fastify.get('/health', healthController.checkHealth.bind(healthController))
    fastify.get('/dbhealth', healthController.checkDbHealth.bind(healthController))

}