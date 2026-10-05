import { readFileSync } from "node:fs";
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";
export function databaseOptions(
  env: Record<string, string | undefined> = process.env,
): PoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl:
      env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ca: env.DATABASE_CA_FILE
              ? readFileSync(env.DATABASE_CA_FILE, "utf8")
              : undefined,
            servername: env.DATABASE_TLS_SERVERNAME,
            checkServerIdentity: env.DATABASE_TLS_SERVERNAME
              ? (_host, cert) =>
                  checkServerIdentity(env.DATABASE_TLS_SERVERNAME!, cert)
              : undefined,
          }
        : undefined,
  };
}
