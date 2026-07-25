import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon-http (fetch-based, no persistent connection) is the right fit for
// Vercel serverless functions — no pool to manage across cold starts.
//
// Falls back to a placeholder connection string so `next build` (and any
// module that imports this at the top level) doesn't crash when
// DATABASE_URL isn't set yet — the neon() client doesn't connect eagerly,
// so this only surfaces as a real error when a query actually runs. See
// .env.example for what to set in development and on Vercel.
const sql = neon(process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/postgres");

export const db = drizzle(sql, { schema });
