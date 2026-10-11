import "server-only";
import { createAuth } from "./auth-options";
import { getDatabase } from "./database";
let instance: ReturnType<typeof createAuth> | undefined;
export function authConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_URL &&
    process.env.BETTER_AUTH_SECRET,
  );
}
export function getAuth() {
  if (!authConfigured()) throw new Error("Authentication is not configured.");
  return (instance ??= createAuth(getDatabase()));
}
