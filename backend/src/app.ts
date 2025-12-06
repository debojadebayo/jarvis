import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { registerRateLimit } from "./api/middleware/rate-limit";
import { errorHandler } from "./api/middleware/error-handler";
import { conversationRoutes } from "./api/routes/conversation.routes";
import { healthRoutes } from "./api/routes/health.routes";


export async function buildApp(){
    const app = Fastify({
        logger: true,
    });
    app.setErrorHandler(errorHandler)

    app.register(healthRoutes)

    await app.register(cors, {
        origin: env.NODE_ENV === 'production' ? /^chrome-extension:\/\// : true,
    });

    await registerRateLimit(app);

    app.register(conversationRoutes, { prefix: '/api/v1'})
    app

    return app
}