import { writeFile, readFile } from "node:fs/promises";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { parseR2Credentials } from "../src/domain/r2-credentials";
const name =
  process.env.TPA_REHEARSAL_DB_NAME ?? "tpa_onboarding_test_realdata_20261011";
if (!/^tpa_onboarding_test_[a-z0-9_]+$/.test(name))
  throw Error("Isolated database required.");
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/" + name;
const env: Record<string, string | undefined> = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: "http://127.0.0.1:3118",
  TPA_TEST_URL: "http://127.0.0.1:3118",
  ONBOARDING_ENABLED: "true",
  TPA_MAIL_SINK: "true",
  TPA_TEST_STORAGE: "false",
  RESEND_API_KEY: "",
  RESEND_DOMAIN_VERIFIED: "false",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  TPA_BROWSER_CHANNEL: "chrome",
};
if (process.env.CLOUDFLARE_CREDENTIAL_FILE) {
  const credentials = parseR2Credentials(
    await readFile(process.env.CLOUDFLARE_CREDENTIAL_FILE, "utf8"),
  );
  Object.assign(env, {
    R2_ACCOUNT_ID: credentials.accountId,
    R2_ACCESS_KEY_ID: credentials.accessKeyId,
    R2_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    R2_BUCKET_NAME: "tpa-private-documents",
    CLOUDFLARE_CREDENTIAL_FILE: "",
  });
}
const keys = [
  "DATABASE_URL",
  "TPA_DATABASE_NAME",
  "DATABASE_SSL",
  "DATABASE_CA_FILE",
  "DATABASE_CA_PEM",
  "DATABASE_TLS_SERVERNAME",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "TPA_TEST_URL",
  "ONBOARDING_ENABLED",
  "TPA_MAIL_SINK",
  "TPA_TEST_STORAGE",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "CLOUDFLARE_CREDENTIAL_FILE",
  "RESEND_API_KEY",
  "RESEND_DOMAIN_VERIFIED",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "TPA_BROWSER_CHANNEL",
];
await writeFile(
  ".local/real-data/rehearsal.env",
  keys
    .filter((k) => env[k] !== undefined)
    .map((k) => `${k}=${JSON.stringify(env[k])}`)
    .join("\n") + "\n",
);
const db = new Pool(databaseOptions(env));
try {
  if ((await db.query("SELECT current_database() n")).rows[0].n !== name)
    throw Error("Database identity mismatch.");
  const actor = (
    await db.query(
      "SELECT user_id FROM tpa.staff_roles WHERE role='administrator' ORDER BY user_id LIMIT 1",
    )
  ).rows[0];
  if (!actor) throw Error("Restored administrator required.");
  const token = randomBytes(32).toString("hex"),
    id = randomUUID();
  await db.query(
    'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'6 hours\',now())',
    [id, token, actor.user_id],
  );
  const cookie =
    "better-auth.session_token=" +
    encodeURIComponent(
      token +
        "." +
        createHmac("sha256", env.BETTER_AUTH_SECRET!)
          .update(token)
          .digest("base64"),
    );
  await writeFile(".local/real-data/rehearsal-cookie.txt", cookie);
  console.log(
    "Isolated runtime settings and temporary rehearsal session prepared; secrets suppressed.",
  );
} finally {
  await db.end();
}
