import 'dotenv/config';
import { env } from './config/env';
import { buildApp } from './app';
import { closeConnection } from './infrastructure/db';

const app = await buildApp()


const shutdown = async (signal:string) => {
    app.log.info(`Received ${signal}, shutting down`)
    
    try {
        await app.close()
        await closeConnection()
        app.log.info('Shutdown complete')
        process.exit(0)
    } catch (error) {
        app.log.error(`Error shutting down: ${error}`)
        process.exit(1)
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', ()=> shutdown('SIGINT'))


try {
    await app.listen({ port: env.PORT , host: env.HOST });
} catch (err) {
    app.log.error(err);
    process.exit(1);
};
