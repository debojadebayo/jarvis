import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { registerRateLimit } from "./api/middleware/rate-limit";
import { errorHandler } from "./api/middleware/error-handler";
import { validate } from "./api/middleware/validate";


export async function buildApp(){
    const app = Fastify({
        logger: true,
    });
    app.setErrorHandler(errorHandler)

    app.get('/health', async (_request, _reply) => {
        return { status: 'ok' };
    });

    await app.register(cors, {
        origin: env.NODE_ENV === 'production' ? /^chrome-extension:\/\// : true,
    });

    await registerRateLimit(app);

    return app
}