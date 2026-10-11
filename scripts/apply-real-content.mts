import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
const base = process.env.TPA_CONTENT_URL;
if (
  !base ||
  (!base.startsWith("http://127.0.0.1:") &&
    base !== "https://tpassociation.org")
)
  throw Error("Set the explicit rehearsal or canonical production origin.");
const folder = resolve(".local/real-data"),
  manifest = JSON.parse(
    await readFile(join(folder, "content-manifest.json"), "utf8"),
  );
const production = base === "https://tpassociation.org";
if (production && process.env.TPA_APPLY_PRODUCTION_CONTENT !== "true")
  throw Error("Explicit production content execution required.");
const cookieFile = process.env.TPA_CONTENT_COOKIE_FILE;
let cookie: string;
if (cookieFile && !production)
  cookie = (await readFile(cookieFile, "utf8")).trim();
else {
  const password = /^Password: (.+)$/m.exec(
    await readFile(".local/first-admin-password.txt", "utf8"),
  )?.[1];
  if (!password) throw Error("Administrator credential unavailable.");
  const response = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      email: "tollygungecacpestudycircle@gmail.com",
      password,
    }),
  });
  if (!response.ok)
    throw Error(
      "Administrator sign-in failed; credentials and provider diagnostics suppressed.",
    );
  cookie = response.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
}
const report: {
  people: {
    name: string;
    id: string;
    portraitId?: string;
    published?: boolean;
    created?: boolean;
    portraitCreated?: boolean;
    previous?: unknown;
  }[];
  payment?: { id: string; active: boolean };
} = { people: [] };
const reportPath = join(
  folder,
  production
    ? "production-content-results.json"
    : "rehearsal-content-results.json",
);
async function saveReport() {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
async function api(path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      origin: base,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(
      `${path}: ${response.status} ${data.error ?? "Operation failed"}`,
    );
  return data;
}
try {
  const inventory = await api("/api/staff/governance");
  const group = inventory.groups.filter(
    (g: { draft: { name: string }; archived: boolean }) =>
      g.draft.name === "Executive Committee" && !g.archived,
  );
  assert.equal(group.length, 1, "One authoritative executive group required");
  if (!group[0].published)
    await api("/api/staff/profile-groups", {
      action: "publish",
      id: group[0].id,
      version: group[0].version,
    });
  for (const [index, p] of manifest.people.entries()) {
    const existing = inventory.records.filter(
      (r: { draft: { name: string } }) => r.draft.name === p.name,
    );
    assert.ok(
      existing.length <= 1,
      "Ambiguous committee identity; stop without merging",
    );
    let person = existing[0];
    if (person)
      assert.ok(
        isDeepStrictEqual(person.draft, person.accepted),
        "Existing committee profile has an unaccepted draft; stop without overwriting it.",
      );
    const executiveAssignment = {
      groupId: group[0].id,
      role: p.role,
      term: "",
      order: index,
    };
    let exactPortrait = false;
    if (person?.accepted.portraitId) {
      const response = await fetch(
        base + `/api/profile-portraits/${person.accepted.portraitId}`,
      );
      exactPortrait =
        response.ok &&
        createHash("sha256")
          .update(new Uint8Array(await response.arrayBuffer()))
          .digest("hex") === p.preparedHash;
    }
    if (
      person &&
      person.accepted.biography === p.biography &&
      person.published &&
      exactPortrait &&
      person.accepted.assignments.some((a: unknown) =>
        isDeepStrictEqual(a, executiveAssignment),
      )
    ) {
      assert.equal(
        person.accepted.biography,
        p.biography,
        "Existing editorial content differs; explicit reconciliation required",
      );
      assert.ok(
        person.published,
        "Existing matching profile is not published; reconcile before retry",
      );
      report.people.push({
        name: p.name,
        id: person.id,
        portraitId: person.accepted.portraitId,
        published: true,
        created: false,
        portraitCreated: false,
      });
      await saveReport();
      continue;
    }
    if (person)
      assert.ok(
        !person.accepted.biography || person.accepted.biography === p.biography,
        "Existing biography requires reconciliation",
      );
    const body = {
      ...(person?.accepted ?? {}),
      name: p.name,
      biography: p.biography,
      assignments: [
        ...(person?.accepted.assignments ?? []).filter(
          (a: { groupId: string }) => a.groupId !== group[0].id,
        ),
        executiveAssignment,
      ],
      links: person?.accepted.links ?? [],
      portraitId: null,
      portraitKind: "profile",
    };
    person = await api("/api/staff/governance", {
      action: "save",
      id: person?.id,
      version: person?.version ?? 0,
      body,
    });
    const result = {
      name: p.name,
      id: person.id,
      portraitId: undefined as string | undefined,
      published: false,
      created: !existing[0],
      portraitCreated: false,
      previous: existing[0]
        ? {
            accepted: existing[0].accepted,
            draft: existing[0].draft,
            published: existing[0].published,
            version: existing[0].version,
            status: existing[0].status,
            accepted_verified: existing[0].accepted_verified,
          }
        : undefined,
    };
    report.people.push(result);
    await saveReport();
    const form = new FormData();
    form.set("personId", person.id);
    form.set("altText", `Portrait of ${p.name}`);
    form.set("crop", JSON.stringify(p.crop));
    form.set(
      "file",
      new File(
        [await readFile(resolve("../client/Imprtant perosn List", p.filename))],
        p.filename,
        { type: "image/jpeg" },
      ),
    );
    const upload = await fetch(base + "/api/profile-portraits", {
      method: "POST",
      headers: { cookie, origin: base },
      body: form,
    });
    const portrait = await upload.json();
    if (!upload.ok) throw Error(`Portrait upload failed: ${upload.status}`);
    result.portraitId = portrait.id;
    result.portraitCreated = true;
    await saveReport();
    person = await api("/api/staff/governance", {
      action: "save",
      id: person.id,
      version: person.version,
      body: { ...body, portraitId: portrait.id },
    });
    person = await api("/api/staff/governance", {
      action: "submit",
      id: person.id,
      version: person.version,
    });
    const review = person.reviews.find(
      (r: { status: string }) => r.status === "pending",
    );
    assert.ok(review);
    person = await api("/api/staff/profile-reviews", {
      action: "approve_editorial",
      id: person.id,
      version: person.version,
      reviewId: review.id,
      reason:
        "Reviewed supplied committee biography, role and confirmed photograph mapping.",
    });
    person = await api("/api/staff/governance", {
      action: "publish",
      id: person.id,
      version: person.version,
      confirmPublication: true,
    });
    assert.equal(person.published.biography, p.biography);
    assert.equal(person.published.portraitId, portrait.id);
    const response = await fetch(
      base + `/api/profile-portraits/${portrait.id}`,
    );
    assert.equal(response.status, 200, "Published portrait available");
    assert.equal(
      createHash("sha256")
        .update(new Uint8Array(await response.arrayBuffer()))
        .digest("hex"),
      p.preparedHash,
      "Published crop matches the visually reviewed photograph",
    );
    result.published = true;
    await saveReport();
    console.log(
      `Committee profile ${index + 1}/8 published and portrait verified.`,
    );
  }
  const payments = await api("/api/staff/payment-details"),
    existing = payments.records.filter(
      (r: { draft: { method: string; accountNumber: string } }) =>
        r.draft.method === "bank" &&
        r.draft.accountNumber === manifest.payment.accountNumber,
    );
  assert.ok(existing.length <= 1, "Ambiguous bank instruction records");
  let payment = existing[0];
  if (!payment)
    payment = await api("/api/staff/payment-details", {
      action: "save",
      version: 0,
      details: manifest.payment,
    });
  else
    assert.deepEqual(
      payment.draft,
      manifest.payment,
      "Existing bank instructions differ",
    );
  report.payment = { id: payment.id, active: payment.status === "active" };
  await saveReport();
  if (payment.status !== "active")
    payment = await api("/api/staff/payment-details", {
      action: "active",
      id: payment.id,
      version: payment.version,
      confirmPayee: true,
    });
  report.payment.active = true;
  await saveReport();
  const member = await api("/api/member/payment-details");
  assert.deepEqual(
    member.records.find((r: { id: string }) => r.id === payment.id).details,
    manifest.payment,
  );
  assert.equal(member.collectionEnabled, false);
  assert.equal((await fetch(base + "/api/member/payment-details")).status, 401);
  console.log(
    "Bank instructions activated, exact supplied values verified, anonymous access denied.",
  );
} finally {
  if (production || !cookieFile)
    await fetch(base + "/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: "{}",
    });
}
