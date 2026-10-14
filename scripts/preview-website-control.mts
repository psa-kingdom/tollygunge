import { Pool } from "pg";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { hashPassword } from "better-auth/crypto";
import assert from "node:assert/strict";
import { resolve } from "node:path";
// Restored-data preview only. No workers; production storage permits reads only.
const name = "tpa_website_preview_" + randomUUID().replaceAll("-", ""),
  base = "http://127.0.0.1:3149";
const local = new Pool({
  connectionString: "postgresql://tpa_qa@127.0.0.1:55439/postgres",
  ssl: false,
});
let db: Pool | undefined, server: ReturnType<typeof spawn> | undefined;
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
};
for (const file of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
]) {
  try {
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
      const key = line.match(
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
      )?.[1];
      if (key) env[key] = /^R2_/.test(key) ? process.env[key] : "";
    }
  } catch {}
}
Object.assign(env, {
  DATABASE_URL: "postgresql://tpa_qa@127.0.0.1:55439/" + name,
  DATABASE_SSL: "false",
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  ONBOARDING_ENABLED: "false",
  EMAIL_OPERATIONS_ENABLED: "false",
  EVENT_PROMOTIONS_ENABLED: "false",
  EVENT_REMINDERS_ENABLED: "false",
  MEMBER_IMPORT_WORKER_ENABLED: "false",
  TPA_MAIL_SINK: "true",
});
try {
  await local.query("CREATE DATABASE " + name);
  db = new Pool({ connectionString: env.DATABASE_URL, ssl: false });
  await db.query(
    (
      await readFile(".local/live-product/website-recovery.sql", "utf8")
    ).replace(/^\\(?:un)?restrict.*$/gm, ""),
  );
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const user = randomUUID(),
    email = user + "@example.invalid",
    password = randomBytes(24).toString("base64url");
  await db.query(
    'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Local QA administrator\',$2,true)',
    [user, email],
  );
  await db.query(
    'INSERT INTO public."account"(id,"accountId","providerId","userId",password,"updatedAt") VALUES($1,$2,\'credential\',$2,$3,now())',
    [randomUUID(), user, await hashPassword(password)],
  );
  await db.query(
    "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
    [user],
  );
  await mkdir(".local/website-preview", { recursive: true });
  await writeFile(
    ".local/website-preview/access.json",
    JSON.stringify({ base, email, password, syntheticLocalOnly: true }),
    { mode: 0o600 },
  );
  const shim = resolve(".local/website-preview/read-only-storage.cjs");
  await writeFile(
    shim,
    `const https=require('node:https'),request=https.request;https.request=function(options,callback){if(!['GET','HEAD'].includes(options.method??'GET'))throw Error('Preview storage is read-only');return request.call(this,options,callback)};`,
  );
  const fs = await import("node:fs"),
    log = fs.openSync(".local/website-preview/server.log", "w");
  server = spawn(
    process.execPath,
    [
      "--require",
      shim,
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3149",
    ],
    { env, stdio: ["ignore", log, log] },
  );
  fs.closeSync(log);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error("Preview stopped");
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready);
  console.log(
    "Local restored-data preview ready on loopback port 3149. Production storage writes blocked; no workers started.",
  );
  await new Promise<void>((r) => {
    process.stdin.once("data", () => r());
    process.once("SIGTERM", () => r());
    process.once("SIGINT", () => r());
  });
  const ids = (
    await db.query(
      "SELECT id FROM tpa.people WHERE draft->>'name'='TPA QA Temporary Person 20261012'",
    )
  ).rows.map((r) => r.id);
  const content = (
    await db.query(
      "SELECT id,archived_at IS NOT NULL archived FROM tpa.content_entries WHERE slug='tpa-live-qa-20261012'",
    )
  ).rows;
  const people = (
    await db.query(
      "SELECT id,archived_at IS NOT NULL archived FROM tpa.people WHERE id=ANY($1::uuid[])",
      [ids],
    )
  ).rows;
  await writeFile(
    ".local/website-preview/cleanup-rehearsal.json",
    JSON.stringify(
      { localOnly: true, productionWrites: 0, content, people },
      null,
      2,
    ),
  );
} finally {
  if (server) {
    server.kill();
    if (server.exitCode === null)
      await new Promise((r) => server!.once("exit", r));
  }
  await db?.end();
  await local.query("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
  await local.end();
  console.log("Exact local preview database removed.");
}
