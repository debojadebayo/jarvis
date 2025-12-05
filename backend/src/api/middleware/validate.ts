import { FastifyRequest, FastifyReply } from "fastify";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../../errors";

export function validate<T>(schema: ZodSchema<T>) {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const validatedBody = schema.parse(request.body);
            request.body = validatedBody;
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                throw new ValidationError('Invalid request body', details);
            }
            throw error;
        }
    }
}