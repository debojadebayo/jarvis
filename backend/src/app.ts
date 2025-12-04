import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { registerRateLimit } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";


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