import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fs from "fs";
import { env } from "./config/env";
import { registerRateLimit } from "./api/middleware/rate-limit";
import { errorHandler } from "./api/middleware/error-handler";
import { conversationRoutes, healthRoutes } from "./api/routes/index";


export async function buildApp(): Promise<FastifyInstance> {
    const httpsOptions = (env.SSL_CERT_PATH && env.SSL_KEY_PATH)
        ? {
            key: fs.readFileSync(env.SSL_KEY_PATH),
            cert: fs.readFileSync(env.SSL_CERT_PATH),
        }
        : null;

    const app = Fastify({
        logger: true,
        ...(httpsOptions && { https: httpsOptions }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as unknown as FastifyInstance;
    app.setErrorHandler(errorHandler)

    app.register(healthRoutes)

    await app.register(cors, {
        origin: env.NODE_ENV === 'production' ? /^chrome-extension:\/\// : true,
    });

    await registerRateLimit(app);

    app.register(conversationRoutes, { prefix: '/api/v1'})
    return app
}