import { passwordPolicy } from "@/domain/password-policy";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { email as memberEmail } from "@/domain/member-foundation";
import type { Pool } from "pg";
import { queueOnboardingMail, hashToken } from "./onboarding-mail";
import { recoveryConfigured, sendRecoveryEmail } from "./auth-email";

export function createAuth(
  database: Pool,
  env: Record<string, string | undefined> = process.env,
  recoverySender?: (email: string, url: string, token: string) => Promise<void>,
) {
  const invitationHeld = async (userId: string) =>
    Boolean(
      (
        await database.query(
          "SELECT 1 FROM tpa.account_invitation_holds WHERE user_id=$1 AND released_at IS NULL",
          [userId],
        )
      ).rowCount,
    );
  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (
          !["/request-password-reset", "/send-verification-email"].includes(
            context.path,
          ) ||
          typeof context.body?.email !== "string"
        )
          return;
        const held = (
          await database.query(
            'SELECT 1 FROM public."user" u JOIN tpa.account_invitation_holds h ON h.user_id=u.id WHERE lower(btrim(u.email))=$1 AND h.released_at IS NULL',
            [context.body.email.trim().toLowerCase()],
          )
        ).rowCount;
        // A generic success prevents account enumeration, tokens and mail before release.
        if (held)
          return context.json({
            status: true,
            message:
              "If this email exists in our system, check your email for the next step.",
          });
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const normalized = memberEmail(user.email, true);
            if (
              (
                await database.query(
                  "SELECT 1 FROM tpa.people WHERE lower(btrim(contact_email))=$1 AND user_id IS NULL",
                  [normalized],
                )
              ).rowCount
            )
              throw new APIError("CONFLICT", {
                message:
                  "A member record already exists. Ask staff to link or invite your website account.",
              });
            return { data: { ...user, email: normalized } };
          },
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
            if (await invitationHeld(session.userId))
              throw new APIError("FORBIDDEN", {
                message:
                  "Account access is awaiting invitation release by TPA.",
              });
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
        create: {
          before: async (account) => {
            if (await invitationHeld(account.userId))
              throw new APIError("FORBIDDEN", {
                message:
                  "Account access is awaiting invitation release by TPA.",
              });
            return { data: account };
          },
        },
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
      minPasswordLength: passwordPolicy.minimum,
      maxPasswordLength: passwordPolicy.maximum,
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
        if (await invitationHeld(user.id)) return;
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
