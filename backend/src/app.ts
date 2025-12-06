import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { registerRateLimit } from "./api/middleware/rate-limit";
import { errorHandler } from "./api/middleware/error-handler";
import { conversationRoutes, healthRoutes } from "./api/routes/index";


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
    return app
}