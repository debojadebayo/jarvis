export abstract class AppError extends Error {
    abstract statusCode: number;
    abstract code: string;

    constructor(message:string, public details?: unknown) {
        super(message);
        this.name = this.constructor.name;
    }

    toJSON() {
        return {
            error: this.code,
            message: this.message,
            details: this.details,
            statusCode: this.statusCode,
        }
    }
}