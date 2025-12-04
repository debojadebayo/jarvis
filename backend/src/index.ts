import 'dotenv/config';
import { env } from './config/env';
import { buildApp } from './app';

const app = await buildApp()

try {
    await app.listen({ port: env.PORT , host: env.HOST });
} catch (err) {
    app.log.error(err);
    process.exit(1);
};


