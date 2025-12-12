import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/conversations',
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: "timestamp",
    table: "__drizzle_migrations__",
    schema: "public",
  }
})


// dialect: "postgresql" | "mysql" | "sqlite" | "turso" | "singlestore" | "gel";
//     out?: string | undefined;
//     breakpoints?: boolean | undefined;
//     tablesFilter?: string | string[] | undefined;
//     extensionsFilters?: "postgis"[] | undefined;
//     schemaFilter?: string | string[] | undefined;
//     schema?: string | string[] | undefined;
//     verbose?: boolean | undefined;
//     strict?: boolean | undefined;
//     casing?: "camelCase" | "snake_case" | undefined;
//     migrations?: {
//         table?: string | undefined;
//         schema?: string | undefined;
//         prefix?: "index" | "timestamp" | "supabase" | "unix" | "none" | undefined;
//     } | undefined;
//     introspect?: {
//         ...;
//     } | undefined;
//     entities?: {
//         ...;
//     } | undefined;
// } & ({} | ... 10 more ... | {
//     ...;
// })