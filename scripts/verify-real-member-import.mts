// Explicitly invoked operational workflow. Uses the authenticated import API,
// then an independent database connection; never writes members with raw SQL.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_REAL_IMPORT_URL;
if (
  !base ||
  (!base.startsWith("http://127.0.0.1:") &&
    base !== "https://tpassociation.org")
)
  throw Error("Set explicit rehearsal or canonical production origin.");
const production =
  base === "https://tpassociation.org" ||
  (process.env.TPA_REAL_IMPORT_PRODUCTION_LOCAL === "true" &&
    base.startsWith("http://127.0.0.1:"));
if (production && process.env.TPA_COMMIT_REAL_MEMBERS !== "true")
  throw Error("Explicit production import execution required.");
const db = new Pool(databaseOptions());
const prefix = production ? "production" : "rehearsal",
  folder = ".local/real-data",
  filename = "../client/Database-200 CA.xlsx",
  bytes = await readFile(filename);
let cookie: string;
if (!production) {
  assert.ok(process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"));
  cookie = (await readFile(folder + "/rehearsal-cookie.txt", "utf8")).trim();
} else {
  const backup = JSON.parse(
    await readFile(folder + "/backup-verification.json", "utf8"),
  );
  assert.ok(
    backup.db?.startsWith("tpa_onboarding_test_"),
    "Restored backup evidence required.",
  );
  const password = /^Password: (.+)$/m.exec(
    await readFile(".local/first-admin-password.txt", "utf8"),
  )?.[1];
  assert.ok(password);
  const response = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({
      email: "tollygungecacpestudycircle@gmail.com",
      password,
    }),
  });
  assert.equal(response.status, 200, "Production reauthentication required");
  cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
const report: Record<string, unknown> = {
  expected: 211,
  sourceHash: createHash("sha256").update(bytes).digest("hex"),
  production,
};
async function persist() {
  await writeFile(
    `${folder}/${prefix}-member-results.json`,
    JSON.stringify(report, null, 2),
  );
}
async function api(path: string, body?: unknown) {
  // Validated batches can exceed the fetch transport's five-minute header limit.
  // A timed-out client must never start a second batch: retry the persisted batch.
  const multipart =
    body instanceof FormData
      ? new Request(base + path, { method: "POST", body })
      : null;
  const serialized = multipart
    ? Buffer.from(await multipart.arrayBuffer())
    : body
      ? JSON.stringify(body)
      : undefined;
  const response = await new Promise<Response>((resolve, reject) => {
    const req = (base!.startsWith("https:") ? httpsRequest : httpRequest)(
      base + path,
      {
        method: body ? "POST" : "GET",
        headers: {
          cookie,
          origin: base!,
          ...(serialized
            ? {
                "content-type":
                  multipart?.headers.get("content-type") ?? "application/json",
                "content-length": Buffer.byteLength(serialized),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("error", reject);
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), { status: res.statusCode }),
          ),
        );
      },
    );
    req.setTimeout(20 * 60 * 1000, () =>
      req.destroy(
        new Error(
          "Import transport timed out. Recover only the persisted batch.",
        ),
      ),
    );
    req.on("error", reject);
    req.end(serialized);
  });
  const data = await response.json();
  if (!response.ok) throw Error(`Import API ${response.status}: ${data.error}`);
  return data;
}
async function counts() {
  return (
    await db.query(
      'SELECT (SELECT count(*)::int FROM public."user") AS accounts,(SELECT count(*)::int FROM tpa.people) AS people,(SELECT count(*)::int FROM tpa.memberships) AS memberships,(SELECT count(*)::int FROM tpa.onboarding_mail) AS mail,(SELECT count(*)::int FROM tpa.onboarding_invitations) AS invitations',
    )
  ).rows[0];
}
try {
  const recovery =
    process.env.TPA_REAL_IMPORT_RESUME_BATCH === "true"
      ? JSON.parse(
          await readFile(
            folder + "/" + prefix + "-member-results.json",
            "utf8",
          ),
        )
      : null;
  const actual = (await db.query("SELECT current_database() n")).rows[0].n;
  assert.equal(actual, process.env.TPA_DATABASE_NAME);
  report.database = actual;
  report.before = await counts();
  let alreadyCommitted = false;
  if (recovery) {
    assert.equal(recovery.sourceHash, report.sourceHash);
    assert.equal(recovery.database, actual);
    report.recovery = {
      batchId: recovery.batchId,
      originalBefore: recovery.before,
      reason:
        "Reuse the persisted validated batch against a quiet baseline; never start a second batch during recovery or final-build verification.",
    };
    alreadyCommitted = (
      await db.query(
        "SELECT committed_at IS NOT NULL AS committed FROM tpa.onboarding_batches WHERE id=$1",
        [recovery.batchId],
      )
    ).rows[0].committed;
  }
  await persist();
  const form = new FormData();
  form.set("mode", "existing-members");
  form.set(
    "file",
    new File([bytes], "Database-200 CA.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const preview = recovery
    ? recovery.preview
    : await api("/api/staff/onboarding-import", form);
  assert.equal(preview.rows.length, 211);
  report.batchId = preview.id;
  report.preview = preview;
  const savedPolicy = (
    await db.query(
      "SELECT choices,source_hash FROM tpa.onboarding_batches WHERE id=$1",
      [preview.id],
    )
  ).rows[0];
  assert.equal(savedPolicy.choices.preserveExisting, true);
  assert.equal(savedPolicy.choices.allowDistrictDerivation, false);
  assert.equal(savedPolicy.source_hash, report.sourceHash);
  report.policy = savedPolicy.choices;
  report.districtPolicy =
    "Keep missing districts blank and hold affected rows.";
  for (const row of preview.rows) {
    for (const address of Object.values(row.member?.addresses ?? {}) as {
      district?: string;
    }[])
      assert.equal(
        address.district ?? "",
        "",
        "The source has no District column; preservation imports must not fill it.",
      );
  }
  if (production) {
    const forecast = Object.fromEntries(
      ["created", "updated", "skipped", "conflict", "failed"].map((status) => [
        status,
        preview.rows.filter((row: { status: string }) => row.status === status)
          .length,
      ]),
    );
    assert.deepEqual(
      forecast,
      { created: 0, updated: 0, skipped: 0, conflict: 134, failed: 77 },
      "Production preview differs from the exact rehearsed batch; stop before commit.",
    );
  }
  await persist();
  if (process.env.TPA_REAL_IMPORT_PREVIEW_ONLY === "true") {
    report.previewTotals = Object.fromEntries(
      ["created", "updated", "skipped", "conflict", "failed"].map((s) => [
        s,
        preview.rows.filter((r: { status: string }) => r.status === s).length,
      ]),
    );
    await persist();
    console.log(
      JSON.stringify({
        expected: 211,
        ...(report.previewTotals as object),
        previewOnly: true,
      }),
    );
  } else {
    const ready = preview.rows.filter(
      (r: { status: string }) => r.status === "created",
    );
    // Explicitly persist the user-approved choices: no updates, no account/email provision.
    const choices = await api("/api/staff/onboarding-import", {
      action: "choices",
      id: preview.id,
      version: preview.version,
      updateRows: [],
      provisionAccounts: false,
    });
    const committed = await api("/api/staff/onboarding-import", {
      action: "commit",
      id: preview.id,
      version: choices.version,
    });
    report.results = committed.results;
    report.totals = Object.fromEntries(
      ["created", "updated", "skipped", "conflict", "failed"].map((s) => [
        s,
        committed.results.filter((r: { status: string }) => r.status === s)
          .length,
      ]),
    );
    await persist();
    assert.equal(committed.results.length, 211);
    assert.equal(
      committed.results.filter(
        (r: { status: string }) => r.status === "updated",
      ).length,
      0,
    );
    const created = committed.results.filter(
      (r: { status: string }) => r.status === "created",
    );
    assert.equal(
      created.length,
      ready.length,
      "Unexplained commit count difference; stop before further operations",
    );
    const after = await counts();
    report.after = after;
    assert.equal(
      after.accounts,
      (report.before as { accounts: number }).accounts,
    );
    assert.equal(after.mail, (report.before as { mail: number }).mail);
    assert.equal(
      after.invitations,
      (report.before as { invitations: number }).invitations,
    );
    assert.equal(
      after.memberships,
      (report.before as { memberships: number }).memberships +
        (alreadyCommitted ? 0 : created.length),
    );
    const saved = (
      await db.query(
        "SELECT p.*,m.membership_number,m.type,m.status AS membership_status,m.valid_from,m.valid_until,m.source AS membership_source FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.id=ANY($1::uuid[])",
        [created.map((r: { personId: string }) => r.personId)],
      )
    ).rows;
    assert.equal(saved.length, created.length);
    for (const result of created) {
      const row = preview.rows.find(
          (r: { sourceRow: number }) => r.sourceRow === result.sourceRow,
        ),
        stored = saved.find((p) => p.id === result.personId),
        m = row.member;
      assert.equal(stored.membership_number, m.membershipNumber);
      assert.equal(stored.contact_email, m.email);
      assert.equal(
        stored.accepted.name,
        [m.prefix, m.firstName, m.lastName].filter(Boolean).join(" "),
      );
      assert.equal(stored.user_id, null);
      assert.equal(stored.accepted_verified, false);
      assert.equal(stored.published, null);
      for (const key of [
        "prefix",
        "firstName",
        "lastName",
        "email",
        "mobile",
        "organization",
      ])
        assert.equal(stored.accepted[key], m[key]);
      assert.equal(stored.accepted.jobTitle, m.designation);
      assert.deepEqual(stored.accepted.addresses, m.addresses);
      for (const key of [
        "type",
        "membership_status",
        "valid_from",
        "valid_until",
      ])
        assert.equal(stored[key], null);
      assert.equal(stored.membership_source, "import");
    }
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM (SELECT lower(btrim(contact_email)) FROM tpa.people WHERE contact_email IS NOT NULL AND btrim(contact_email)<>'' GROUP BY 1 HAVING count(*)>1) d",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM (SELECT lower(regexp_replace(btrim(membership_number),'\\s+',' ','g')) FROM tpa.memberships GROUP BY 1 HAVING count(*)>1) d",
        )
      ).rows[0].n,
      0,
    );
    const repeat = await api("/api/staff/onboarding-import", {
      action: "commit",
      id: preview.id,
    });
    assert.equal(repeat.duplicate, true);
    assert.deepEqual(repeat.results, committed.results);
    assert.deepEqual(await counts(), after);
    if (!production) {
      const fixture = {
        prefix: "CA",
        firstName: "Synthetic",
        lastName: "Regression",
        email: `regression-${preview.id}@example.invalid`,
        mobile: "",
        designation: "",
        organization: "Synthetic regression",
        membershipNumber: `QA-${preview.id}`,
        addresses: {},
      };
      const createdFixture = await api("/api/staff/members", {
        action: "create",
        member: fixture,
        provisionAccount: false,
      });
      const fixtureId = createdFixture.result.personId;
      try {
        const view = await api(
            `/api/staff/members?view=register&id=${fixtureId}`,
          ),
          record = view.rows[0];
        assert.equal(record.person.firstName, "Synthetic");
        await api("/api/staff/members", {
          action: "update",
          personId: fixtureId,
          personVersion: record.person_version,
          membershipVersion: record.membership_version,
          member: { ...fixture, organization: "Synthetic regression updated" },
          provisionAccount: false,
        });
        assert.equal(
          (await api(`/api/staff/members?view=register&id=${fixtureId}`))
            .rows[0].person.organization,
          "Synthetic regression updated",
        );
        const first = created.length
          ? preview.rows.find(
              (r: { sourceRow: number }) =>
                r.sourceRow === created[0].sourceRow,
            ).member
          : fixture;
        for (const member of [
          {
            ...fixture,
            email: `duplicate-${preview.id}@example.invalid`,
            membershipNumber: first.membershipNumber,
          },
          {
            ...fixture,
            email: first.email,
            membershipNumber: `DUP-${preview.id}`,
          },
        ]) {
          const response = await fetch(base + "/api/staff/members", {
            method: "POST",
            headers: {
              cookie,
              origin: base,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              action: "create",
              member,
              provisionAccount: false,
            }),
          });
          assert.equal(
            response.status,
            409,
            "Duplicate member identity rejected",
          );
        }
      } finally {
        await db.query("BEGIN");
        try {
          await db.query(
            "DELETE FROM tpa.person_revisions WHERE person_id=$1",
            [fixtureId],
          );
          await db.query("DELETE FROM tpa.audit_events WHERE entity_id=$1", [
            fixtureId,
          ]);
          await db.query("DELETE FROM tpa.memberships WHERE person_id=$1", [
            fixtureId,
          ]);
          await db.query("DELETE FROM tpa.people WHERE id=$1", [fixtureId]);
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK");
          throw e;
        }
      }
      assert.deepEqual(await counts(), after);
      report.individualRegression = {
        create: true,
        edit: true,
        view: true,
        duplicateMembershipNumber: true,
        duplicateEmail: true,
        fixtureRemoved: true,
      };
    }
    report.independentVerification = {
      allCreatedRows: created.length
        ? true
        : "Not applicable: no eligible rows",
      uniqueness: true,
      noAccountsOrEmails: true,
      noPaidOrVerificationAssertions: true,
      repeatedCommitSafe: true,
      sampleSourceRows: [
        created[0]?.sourceRow,
        created[Math.floor(created.length / 2)]?.sourceRow,
        created.at(-1)?.sourceRow,
      ],
    };
    assert.equal(
      createHash("sha256")
        .update(await readFile(filename))
        .digest("hex"),
      report.sourceHash,
      "Original workbook unchanged",
    );
    await persist();
    console.log(
      JSON.stringify({
        expected: 211,
        ...(report.totals as object),
        before: report.before,
        after,
        allCreatedRowsVerified: created.length
          ? true
          : "Not applicable: no eligible rows",
      }),
    );
  }
} finally {
  if (production)
    await fetch(base + "/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: "{}",
    });
  await db.end();
}
