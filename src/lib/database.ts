import "server-only";
import { Pool } from "pg";
import { databaseOptions } from "./database-options";
const globalDatabase = globalThis as unknown as { tpaDatabase?: Pool };
export function getDatabase(): Pool {
  if (!process.env.DATABASE_URL)
    throw new Error("TPA database is not configured.");
  if (!globalDatabase.tpaDatabase) {
    globalDatabase.tpaDatabase = new Pool(databaseOptions());
  }
  return globalDatabase.tpaDatabase;
}
