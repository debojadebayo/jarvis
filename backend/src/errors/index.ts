import { AppError } from "./base.errors";

class AuthenticationError extends AppError {
    statusCode = 401;
    code = 'AUTHENTICATION_ERROR';
}

class AuthorizationError extends AppError {
    statusCode = 403
    code = 'AUTHORIZATION_ERROR';
}

class NotFoundError extends AppError {
    statusCode = 404
    code = 'NOT_FOUND_ERROR';
}

class ValidationError extends AppError {
    statusCode = 400
    code = 'VALIDATION_ERROR';
}   

class DatabaseError extends AppError {
    statusCode = 500
    code = 'DATABASE_ERROR';
}

export { AppError } from "./base.errors";
export { AuthenticationError, AuthorizationError, NotFoundError, ValidationError, DatabaseError };