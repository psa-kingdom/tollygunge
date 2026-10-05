import { betterAuth } from "better-auth";
import type { Pool } from "pg";

export function createAuth(
  database: Pool,
  env: Record<string, string | undefined> = process.env,
) {
  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
    emailAndPassword: { enabled: false },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  });
}
