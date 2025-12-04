import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../../config/env.js";
import * as schema from "./schema.js";

const pool = postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10, 
});


export const db = drizzle(pool, { schema });


export async function testConnection(): Promise<boolean> {
    try{
        await pool`SELECT 1`;
        return true;
    } catch (error){
        console.error("Database connection failed:", error);
        return false;
    }
}

export async function closeConnection(): Promise<void> {
    await pool.end();
}

