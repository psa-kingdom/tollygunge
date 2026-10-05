import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import { recoveryConfigured, sendRecoveryEmail } from "./auth-email";

export function createAuth(
  database: Pool,
  env: Record<string, string | undefined> = process.env,
  recoverySender?: (email: string, url: string, token: string) => Promise<void>,
) {
  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
    databaseHooks: {
      account: {
        update: {
          after: async (account, context) => {
            if (
              account.providerId === "credential" &&
              context?.path === "/change-password"
            ) {
              await database.query(
                "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$1)",
                [account.userId, "identity.password_changed"],
              );
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await database.query(
          "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'identity.password_reset',$1)",
          [user.id],
        );
      },
      ...(recoverySender || recoveryConfigured(env)
        ? {
            sendResetPassword: async ({
              user,
              url,
              token,
            }: {
              user: { email: string };
              url: string;
              token: string;
            }) => {
              if (recoverySender) await recoverySender(user.email, url, token);
              else
                await sendRecoveryEmail(
                  user.email,
                  `${env.BETTER_AUTH_URL}/reset-password#token=${encodeURIComponent(token)}`,
                  env,
                );
            },
          }
        : {}),
    },
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
