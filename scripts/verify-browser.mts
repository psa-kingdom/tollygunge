// Ephemeral loopback-only browser fixture. Never deployed or used for real identities.
import { createServer, request as httpRequest } from "node:http";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
if (
  process.env.TPA_BROWSER_TEST !== "true" ||
  process.env.NODE_ENV === "production" ||
  !process.env.BETTER_AUTH_SECRET
)
  throw new Error("Explicit local browser-test configuration is required.");
const pool = new Pool(databaseOptions());
if (
  (await pool.query("SELECT current_database() AS name")).rows[0].name !==
  process.env.TPA_DATABASE_NAME
)
  throw new Error("Unexpected test database.");
const id = randomUUID(),
  token = randomBytes(32).toString("hex");
await pool.query(
  'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
  [id, "Preview Member", id + "@example.invalid"],
);
await pool.query(
  'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'15 minutes\',now())',
  [randomUUID(), token, id],
);
const cookie =
  "better-auth.session_token=" +
  encodeURIComponent(
    token +
      "." +
      createHmac("sha256", process.env.BETTER_AUTH_SECRET)
        .update(token)
        .digest("base64"),
  );
let active = true;
const targetPort = Number(process.env.TPA_BROWSER_TARGET_PORT ?? 3000);
const fixturePort = Number(process.env.TPA_BROWSER_PORT ?? 3001);
if (![3000, 3002].includes(targetPort))
  throw new Error("Unexpected local test target.");
if (![3000, 3001].includes(fixturePort) || fixturePort === targetPort)
  throw new Error("Unexpected fixture port.");
const server = createServer((incoming, outgoing) => {
  if (incoming.url === "/__verification/finish" && incoming.method === "POST") {
    outgoing.writeHead(200);
    outgoing.end("Verification finished.");
    void cleanup();
    return;
  }
  const headers = { ...incoming.headers, host: `127.0.0.1:${targetPort}` };
  if (active) headers.cookie = cookie;
  else delete headers.cookie;
  if (headers.origin === `http://127.0.0.1:${fixturePort}`)
    headers.origin = "http://127.0.0.1:3000";
  const forwarded = httpRequest(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: incoming.url,
      method: incoming.method,
      headers,
    },
    (response) => {
      if (incoming.url === "/api/auth/sign-out" && response.statusCode === 200)
        active = false;
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  forwarded.on("error", () => {
    outgoing.writeHead(502);
    outgoing.end("Local verification server unavailable.");
  });
  incoming.pipe(forwarded);
});
server.listen(fixturePort, "127.0.0.1", () =>
  console.log(
    `Temporary synthetic browser fixture available at http://127.0.0.1:${fixturePort}/member`,
  ),
);
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  server.close();
  try {
    await pool.query("DELETE FROM tpa.inquiry_updates WHERE inquiry_id IN (SELECT id FROM tpa.inquiries WHERE user_id=$1)",[id]);
    await pool.query(
      "DELETE FROM tpa.inquiry_notes WHERE inquiry_id IN (SELECT id FROM tpa.inquiries WHERE user_id=$1)",
      [id],
    );
    await pool.query("DELETE FROM tpa.inquiries WHERE user_id=$1", [id]);
    await pool.query("DELETE FROM tpa.application_drafts WHERE user_id=$1", [
      id,
    ]);
    await pool.query(
      "DELETE FROM tpa.event_attendance WHERE registration_id IN (SELECT id FROM tpa.event_registrations WHERE user_id=$1)",
      [id],
    );
    await pool.query("DELETE FROM tpa.event_registrations WHERE user_id=$1", [
      id,
    ]);
    for (const table of [
      "audit_events",
      "newsletter_consents",
      "member_profiles",
    ]) {
      await pool.query(
        `DELETE FROM tpa.${table} WHERE ${table === "audit_events" ? "actor_user_id" : "user_id"}=$1`,
        [id],
      );
    }
    await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
    await pool.end();
    console.log("Browser fixture identity removed.");
    process.exit(0);
  } catch {
    console.error("Browser fixture cleanup needs attention.");
    process.exit(1);
  }
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
// Bound the lifetime even if the verification session is interrupted.
setTimeout(cleanup, 10 * 60 * 1000).unref();
