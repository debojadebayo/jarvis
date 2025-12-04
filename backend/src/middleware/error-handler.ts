import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors";

export function errorHandler(err: Error, request: FastifyRequest, reply:FastifyReply){
    if(err instanceof AppError){
        reply.status(err.statusCode).send({...err.toJSON()});
    } else {
        request.log.error(err);
        reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
            statusCode: 500,
        });
    }
}