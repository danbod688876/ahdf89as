import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon-http (fetch-based, no persistent connection) is the right fit for
// Vercel serverless functions — no pool to manage across cold starts.
//
// Vercel's native Postgres integration (Neon-backed) names its connection
// string env var POSTGRES_URL, not DATABASE_URL — accept either so the
// Vercel-created var works with no manual renaming.
//
// Falls back to a placeholder connection string so `next build` (and any
// module that imports this at the top level) doesn't crash when neither is
// set yet — the neon() client doesn't connect eagerly, so this only
// surfaces as a real error when a query actually runs. See .env.example
// for what to set in development.
const sql = neon(
  process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    "postgres://user:pass@localhost:5432/postgres"
);

export const db = drizzle(sql, { schema });
