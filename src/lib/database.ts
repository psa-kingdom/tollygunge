import "server-only";
import { Pool } from "pg";
const globalDatabase = globalThis as unknown as { tpaDatabase?: Pool };
export function getDatabase(): Pool {
  if (!process.env.DATABASE_URL)
    throw new Error("TPA database is not configured.");
  if (!globalDatabase.tpaDatabase) {
    globalDatabase.tpaDatabase = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });
  }
  return globalDatabase.tpaDatabase;
}
