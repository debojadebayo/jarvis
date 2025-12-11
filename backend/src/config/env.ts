import { z } from 'zod';


const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    API_KEY: z.string().min(16),
    VOYAGE_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    SSL_CERT_PATH: z.string().min(1).optional(),
    SSL_KEY_PATH: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);

