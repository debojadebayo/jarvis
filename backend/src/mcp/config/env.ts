import { z } from 'zod'

const mcpEnvSchema = z.object({
    API_URL: z.string().url(),
    API_KEY: z.string().min(16)
})

export const env = mcpEnvSchema.parse(process.env)