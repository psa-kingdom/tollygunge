import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import { queueOnboardingMail, hashToken } from "./onboarding-mail";
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
      user: {
        create: {
          after: async (user) => {
            if (env.ONBOARDING_ENABLED === "true")
              await database.query(
                "UPDATE tpa.onboarding_mail SET user_id=$1 WHERE user_id IS NULL AND recipient=$2 AND kind='verification'",
                [user.id, user.email.toLowerCase()],
              );
            if (env.ONBOARDING_ENABLED === "true")
              await queueOnboardingMail(
                database,
                user.id,
                user.email,
                "welcome",
                `${env.BETTER_AUTH_URL}/member`,
                "welcome-" + user.id,
              );
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            const staff = (
              await database.query(
                "SELECT 1 FROM tpa.staff_roles WHERE user_id=$1",
                [session.userId],
              )
            ).rowCount;
            const days =
              env.ONBOARDING_ENABLED === "true" &&
              !staff &&
              context?.headers?.get("x-tpa-keep-signed-in") === "true"
                ? 30
                : 7;
            return {
              data: {
                ...session,
                durationDays: days,
                expiresAt: new Date(Date.now() + days * 86400000),
              },
            };
          },
        },
      },
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
      disableSignUp: env.ONBOARDING_ENABLED !== "true",
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
              user: { id: string; email: string };
              url: string;
              token: string;
            }) => {
              if (recoverySender) await recoverySender(user.email, url, token);
              else {
                const receipt = await sendRecoveryEmail(
                  user.email,
                  `${env.BETTER_AUTH_URL}/reset-password#token=${encodeURIComponent(token)}`,
                  env,
                );
                if (receipt)
                  await database.query(
                    "INSERT INTO tpa.email_receipts(provider_id,user_id,kind) VALUES($1,$2,'recovery') ON CONFLICT DO NOTHING",
                    [receipt, user.id],
                  );
              }
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
    emailVerification: {
      expiresIn: 86400,
      sendOnSignUp: env.ONBOARDING_ENABLED === "true",
      sendOnSignIn: false,
      sendVerificationEmail: async ({ user, url, token }) => {
        if (env.ONBOARDING_ENABLED !== "true") return;
        await queueOnboardingMail(
          database,
          user.id,
          user.email,
          "verification",
          url,
          "verify-" + hashToken(token),
        );
      },
    },
    rateLimit: {
      enabled: env.ONBOARDING_ENABLED === "true",
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 30,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    session: {
      cookieCache: { enabled: false },
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
      additionalFields: {
        durationDays: { type: "number", defaultValue: 7, input: false },
      },
    },
  });
}
