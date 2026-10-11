import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3000";
const handoff = await readFile(".local/first-admin-password.txt", "utf8");
const password = /^Password: (.+)$/m.exec(handoff)?.[1];
assert.ok(password, "Local administrator handoff required");
const response = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({
    email: "tollygungecacpestudycircle@gmail.com",
    password,
  }),
});
assert.equal(response.status, 200, "Administrator password login failed");
const cookie = response.headers.get("set-cookie")!.split(";")[0];
try {
  const admin = await fetch(`${base}/admin`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(admin.status, 200, "Administrator permission rejected");
  assert.ok(
    (await admin.text()).includes("Members"),
    "Staff workspace missing",
  );
  const security = await fetch(`${base}/member/security`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(security.status, 200, "Account security unavailable");
} finally {
  const out = await fetch(`${base}/api/auth/sign-out`, {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(out.status, 200, "Verification session cleanup failed");
}
const revoked = await fetch(`${base}/admin`, {
  headers: { cookie },
  redirect: "manual",
});
assert.equal(revoked.status, 307);
console.log(
  "Approved administrator: password login, staff access, security page and sign-out verified. No password or session printed.",
);
