import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { chromium, expect, type Page } from "@playwright/test";
import { sharedDefaults } from "../src/domain/website-settings";
import { homeDefaults } from "../src/domain/website-home";
import { personBody } from "../src/domain/people";
import { pageSections } from "../src/domain/operations";
import { jsPDF } from "jspdf";
const rootUrl = new URL(process.env.DATABASE_URL ?? "");
assert.equal(rootUrl.hostname, "127.0.0.1");
assert.equal(rootUrl.port, "55439");
const root = new Pool({ connectionString: rootUrl.href, ssl: false }),
  name = "tpa_website_test_" + randomUUID().replaceAll("-", "");
const url = new URL(rootUrl);
url.pathname = "/" + name;
const db = new Pool({ connectionString: url.href, ssl: false });
const base = "http://127.0.0.1:3148",
  dir = resolve(
    ".local/website-control/" + new Date().toISOString().replaceAll(":", "-"),
  );
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
      if (key) env[key] = "";
    }
  } catch {}
}
Object.assign(env, {
  DATABASE_URL: url.href,
  DATABASE_SSL: "false",
  TPA_DATABASE_NAME: name,
  BETTER_AUTH_URL: base,
  BETTER_AUTH_SECRET: "synthetic-website-control-secret-32-characters",
  TPA_MAIL_SINK: "true",
  ONBOARDING_ENABLED: "false",
  EMAIL_OPERATIONS_ENABLED: "false",
  EVENT_REMINDERS_ENABLED: "false",
  EVENT_PROMOTIONS_ENABLED: "false",
  MEMBER_IMPORT_WORKER_ENABLED: "false",
  R2_ACCOUNT_ID: "0".repeat(32),
  R2_ACCESS_KEY_ID: "synthetic",
  R2_SECRET_ACCESS_KEY: "synthetic",
  R2_BUCKET_NAME: "tpa-private-documents",
});
let server: ReturnType<typeof spawn> | undefined,
  storage: Server | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined,
  diagnosticPage: Page | undefined,
  created = false;
const cookies: string[] = [],
  ids: string[] = [],
  scenarios: string[] = [],
  browserErrors: string[] = [],
  views: unknown[] = [];
function pass(s: string) {
  scenarios.push(s);
  console.log("PASS: " + s);
}
async function request(path: string, body?: unknown, actor = 0, status = 200) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      Cookie: actor < 0 ? "" : "better-auth.session_token=" + cookies[actor],
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(result)}`);
  return result;
}
try {
  await mkdir(dir, { recursive: true });
  await root.query("CREATE DATABASE " + name);
  created = true;
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.query(
      "BEGIN;\n" + (await readFile("migrations/" + file, "utf8")) + "\nCOMMIT;",
    );
  for (const role of [
    "administrator",
    "member",
    "content_editor",
    "membership_reviewer",
  ]) {
    const id = randomUUID(),
      token = randomBytes(24).toString("hex");
    ids.push(id);
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, "Synthetic " + role, id + "@example.invalid"],
    );
    if (role !== "member")
      await db.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
        [id, role],
      );
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'2 hours\',now())',
      [randomUUID(), token, id],
    );
    cookies.push(
      encodeURIComponent(
        token +
          "." +
          createHmac("sha256", env.BETTER_AUTH_SECRET!)
            .update(token)
            .digest("base64"),
      ),
    );
  }
  const objects = new Map<string, Buffer>();
  storage = createServer(async (req, res) => {
    const key = new URL(req.url!, "http://127.0.0.1").pathname;
    if (req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      objects.set(key, Buffer.concat(chunks));
      res.end();
    } else if (req.method === "GET") {
      const bytes = objects.get(key);
      if (!bytes) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Length": bytes.length,
        });
        res.end(bytes);
      }
    } else if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(405);
      res.end();
    }
  });
  await new Promise<void>((r) => storage!.listen(0, "127.0.0.1", r));
  const port = (storage.address() as { port: number }).port;
  const shim = dir + "/storage-shim.cjs";
  await writeFile(
    shim,
    `const https=require('node:https'),http=require('node:http');https.request=function(options,callback){if((options.hostname??options.host)?.endsWith('.r2.cloudflarestorage.com'))return http.request({...options,hostname:'127.0.0.1',host:undefined,port:${port},protocol:'http:',agent:undefined},callback);throw Error('External HTTPS disabled during isolated website acceptance');};`,
  );
  const fs = await import("node:fs");
  const log = fs.openSync(dir + "/server.log", "w");
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
      "3148",
    ],
    { env, stdio: ["ignore", log, log] },
  );
  fs.closeSync(log);
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw Error("Acceptance server stopped");
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready);
  await request("/api/staff/website-settings?key=shared", undefined, -1, 401);
  await request("/api/staff/website-settings?key=shared", undefined, 1, 403);
  await request("/api/staff/website-settings?key=shared", undefined, 3, 403);
  pass("Anonymous and member accounts cannot manage public website settings");
  const profile = personBody({
    name: "CA R. N. Singh QA",
    biography: "Synthetic professional description.",
    assignments: [
      {
        groupId: "11111111-1111-4111-8111-111111111111",
        role: "Synthetic Chair",
        term: "",
        order: 0,
      },
    ],
  });
  let person = await request("/api/staff/governance", {
    action: "save",
    version: 0,
    body: profile,
  });
  const newer = Array.from({ length: 205 }, () => randomUUID());
  await db.query(
    "INSERT INTO tpa.people(id,accepted,draft) SELECT id,$2,$2 FROM unnest($1::uuid[]) id",
    [newer, personBody({ name: "Synthetic private person" })],
  );
  await db.query(
    "UPDATE tpa.people SET updated_at=now()-interval '1 year',user_id=$2 WHERE id=$1",
    [person.id, ids[1]],
  );
  await db.query(
    "INSERT INTO tpa.memberships(id,person_id,membership_number,source,status) VALUES($1,$2,'QA-001','staff','active')",
    [randomUUID(), person.id],
  );
  const page1 = await request("/api/staff/governance?page=1"),
    committee = await request(
      "/api/staff/governance?page=1&filter=association",
    );
  assert.equal(page1.total, 206);
  assert.equal(page1.records.length, 50);
  assert.equal(committee.total, 1);
  assert.equal(committee.records[0].id, person.id);
  assert.ok(committee.records[0].membership_id);
  const search = await request(
    "/api/staff/governance?page=1&q=" + encodeURIComponent(profile.name),
  );
  assert.equal(search.total, 1);
  assert.equal(search.records[0].id, person.id);
  const allIds = new Set<string>();
  for (let page = 1; page <= 5; page++)
    for (const row of (await request("/api/staff/governance?page=" + page))
      .records)
      allIds.add(row.id);
  assert.equal(allIds.size, 206);
  pass(
    "Filtered pagination, counts, old committee profiles and canonical member links remain complete beyond 200 people",
  );
  person = await request("/api/staff/governance", {
    action: "submit",
    id: person.id,
    version: person.version,
  });
  const review = person.reviews.find(
    (r: { status: string }) => r.status === "pending",
  );
  person = await request("/api/staff/profile-reviews", {
    action: "approve",
    id: person.id,
    version: person.version,
    reviewId: review.id,
  });
  person = await request("/api/staff/governance", {
    action: "publish",
    id: person.id,
    version: person.version,
    confirmPublication: true,
  });
  assert.ok(
    (await (await fetch(base + "/governance")).text()).includes(
      "About CA R. N. Singh QA",
    ),
  );
  let settings = await request("/api/staff/website-settings?key=shared");
  const shared = structuredClone(sharedDefaults);
  shared.biographyHeading = "Professional journey of {name}";
  shared.footer.location = "Synthetic QA location";
  settings = await request("/api/staff/website-settings", {
    key: "shared",
    action: "save",
    version: settings.version,
    body: shared,
  });
  assert.ok(
    !(await (await fetch(base + "/governance")).text()).includes(
      "Professional journey of",
    ),
  );
  settings = await request("/api/staff/website-settings", {
    key: "shared",
    action: "publish",
    version: settings.version,
  });
  assert.ok(
    (await (await fetch(base + "/governance")).text()).includes(
      "Professional journey of CA R. N. Singh QA",
    ),
  );
  await request(
    "/api/staff/website-settings",
    {
      key: "shared",
      action: "save",
      version: settings.version - 1,
      body: shared,
    },
    0,
    409,
  );
  person = await request("/api/staff/governance", {
    action: "save",
    id: person.id,
    version: person.version,
    body: { ...person.draft, biographyTitle: "Career and contribution" },
  });
  person = await request("/api/staff/governance", {
    action: "submit",
    id: person.id,
    version: person.version,
  });
  person = await request("/api/staff/profile-reviews", {
    action: "approve",
    id: person.id,
    version: person.version,
    reviewId: person.reviews.find(
      (r: { status: string }) => r.status === "pending",
    ).id,
  });
  person = await request("/api/staff/governance", {
    action: "publish",
    id: person.id,
    version: person.version,
    confirmPublication: true,
  });
  assert.ok(
    (await (await fetch(base + "/governance")).text()).includes(
      "Career and contribution",
    ),
  );
  person = await request("/api/staff/governance", {
    action: "archive",
    id: person.id,
    version: person.version,
  });
  assert.ok(
    !(await (await fetch(base + "/governance")).text()).includes(profile.name),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM tpa.memberships WHERE person_id=$1",
        [person.id],
      )
    ).rows[0].n,
    "1",
  );
  person = await request("/api/staff/governance", {
    action: "restore",
    id: person.id,
    version: person.version,
  });
  assert.equal(person.published, null);
  await request(
    "/api/staff/governance",
    { action: "archive", id: person.id, version: person.version },
    1,
    403,
  );
  pass(
    "Biography default and overrides publish safely; archive preserves membership and restore stays private",
  );
  const home = structuredClone(homeDefaults);
  home.copy.heroCopy02 = "Managed homepage headline";
  let homeRow = await request("/api/staff/website-settings", {
    key: "home",
    action: "save",
    version: 0,
    body: home,
  });
  assert.ok(
    !(await (await fetch(base + "/")).text()).includes(
      "Managed homepage headline",
    ),
  );
  homeRow = await request("/api/staff/website-settings", {
    key: "home",
    action: "publish",
    version: homeRow.version,
  });
  assert.equal(homeRow.published.copy.heroCopy02, "Managed homepage headline");
  assert.ok(
    (await (await fetch(base + "/")).text()).includes(
      "Managed homepage headline",
    ),
  );
  let page = await request("/api/staff/content", {
    action: "save",
    version: 0,
    slug: "about",
    kind: "page",
    body: {
      title: "Synthetic page",
      label: "ASSOCIATION QA",
      intro: "Synthetic introduction",
      sections: pageSections.about.map((title, i) => ({
        title: i === 1 ? "Managed vision heading" : title,
        text: "Synthetic page copy.",
      })),
      sourceUrl: "",
      attribution: "",
    },
  });
  page = await request("/api/staff/content", {
    action: "publish",
    id: page.id,
    version: page.version,
  });
  const html = await (await fetch(base + "/about")).text();
  assert.ok(html.includes("Managed vision heading"));
  assert.ok(html.includes("/about#section-1"));
  assert.ok(html.includes("ASSOCIATION QA"));
  page = await request("/api/staff/content", {
    action: "archive",
    id: page.id,
    version: page.version,
  });
  assert.ok(
    !(await request("/api/staff/content")).some(
      (r: { id: string }) => r.id === page.id,
    ),
  );
  page = await request("/api/staff/content", {
    action: "restore",
    id: page.id,
    version: page.version,
  });
  assert.equal(page.published, null);
  pass(
    "Homepage and page copy use draft/publish boundaries; navigation labels and existing anchors agree",
  );
  let link = await request("/api/staff/website-resources", {
    action: "save",
    version: 0,
    kind: "link",
    body: {
      title: "QA important link",
      description: "A managed resource",
      url: "https://example.org/",
      order: 2,
    },
  });
  assert.ok(
    !(await (await fetch(base + "/resources")).text()).includes(
      "QA important link",
    ),
  );
  link = await request("/api/staff/website-resources", {
    action: "publish",
    id: link.id,
    version: link.version,
    kind: "link",
  });
  assert.ok(
    (await (await fetch(base + "/resources")).text()).includes(
      "QA important link",
    ),
  );
  link = await request("/api/staff/website-resources", {
    action: "archive",
    id: link.id,
    version: link.version,
    kind: "link",
  });
  assert.ok(
    !(await (await fetch(base + "/resources")).text()).includes(
      "QA important link",
    ),
  );
  await request("/api/staff/website-resources", {
    action: "restore",
    id: link.id,
    version: link.version,
    kind: "link",
  });
  let document = await request("/api/staff/website-resources", {
    action: "save",
    version: 0,
    kind: "document",
    body: {
      title: "QA PDF download",
      description: "Synthetic PDF",
      url: "",
      order: 1,
    },
  });
  await request(
    "/api/staff/website-resources",
    {
      action: "publish",
      id: document.id,
      version: document.version,
      kind: "document",
    },
    0,
    400,
  );
  async function upload(
    bytes: Uint8Array,
    type = "application/pdf",
    status = 200,
  ) {
    const form = new FormData();
    form.set("resourceId", document.id);
    form.set("version", String(document.version));
    form.set("file", new File([bytes as BlobPart], "qa.pdf", { type }));
    const r = await fetch(base + "/api/staff/website-resource-files", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: "better-auth.session_token=" + cookies[0],
      },
      body: form,
    });
    assert.equal(r.status, status, await r.clone().text());
    return r.json();
  }
  await upload(new TextEncoder().encode("not a PDF"), "application/pdf", 400);
  await upload(new Uint8Array(5 * 1024 * 1024 + 1), "application/pdf", 400);
  const pdf = new jsPDF();
  pdf.text("Synthetic QA PDF one", 20, 20);
  const firstBytes = new Uint8Array(pdf.output("arraybuffer"));
  document = await upload(firstBytes);
  assert.equal((await fetch(base + "/downloads/" + document.id)).status, 404);
  document = await request("/api/staff/website-resources", {
    action: "publish",
    id: document.id,
    version: document.version,
    kind: "document",
  });
  assert.deepEqual(
    new Uint8Array(
      await (await fetch(base + "/downloads/" + document.id)).arrayBuffer(),
    ),
    firstBytes,
  );
  pdf.text("Replacement PDF", 20, 40);
  const secondBytes = new Uint8Array(pdf.output("arraybuffer"));
  document = await upload(secondBytes);
  assert.deepEqual(
    new Uint8Array(
      await (await fetch(base + "/downloads/" + document.id)).arrayBuffer(),
    ),
    firstBytes,
  );
  document = await request("/api/staff/website-resources", {
    action: "publish",
    id: document.id,
    version: document.version,
    kind: "document",
  });
  assert.deepEqual(
    new Uint8Array(
      await (await fetch(base + "/downloads/" + document.id)).arrayBuffer(),
    ),
    secondBytes,
  );
  document = await request("/api/staff/website-resources", {
    action: "withdraw",
    id: document.id,
    version: document.version,
    kind: "document",
  });
  assert.equal((await fetch(base + "/downloads/" + document.id)).status, 404);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM tpa.website_resource_files WHERE resource_id=$1",
        [document.id],
      )
    ).rows[0].n,
    "2",
  );
  pass(
    "Links and PDF downloads publish/withdraw; invalid files are rejected and replacement preserves published bytes and old references",
  );
  if (process.argv.includes("--browser")) {
    browser = await chromium.launch({ channel: process.env.TPA_BROWSER_CHANNEL || undefined, headless: true });
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: cookies[0],
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
      },
    ]);
    const p = await context.newPage();
    diagnosticPage = p;
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    p.on("pageerror", (e) => browserErrors.push(e.message));
    const axe = resolve("node_modules/axe-core/axe.min.js");
    for (const width of [1440, 768, 390, 320]) {
      await p.setViewportSize({ width, height: 1000 });
      for (const path of [
        "/admin/workspaces/governance",
        "/admin/workspaces/website",
        "/admin/workspaces/content",
        "/admin/workspaces/media",
      ]) {
        // Header polling can keep the network active after the workspace is
        // usable. Wait for its protected data and rendered controls instead.
        const workspace = path.split("/").at(-1)!;
        const endpoint =
          workspace === "website" ? "website-settings" : workspace;
        const ready = p.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/staff/${endpoint}` &&
            response.request().method() === "GET",
        );
        await p.goto(base + path, { waitUntil: "domcontentloaded" });
        assert.equal(
          (await ready).status(),
          200,
          `${workspace} data must load`,
        );
        await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
        const loading: Record<string, string> = {
          governance: "Loading people…",
          website: "Loading…",
          content: "Loading content…",
          media: "Loading media…",
        };
        await expect(
          p.locator(".workspace-body").getByText(loading[workspace], { exact: true }),
        ).toHaveCount(0);
        if (workspace === "media")
          await expect(
            p.getByRole("button", { name: "New image", exact: true }),
          ).toBeVisible();
        else
          await expect(
            p.getByRole("tablist", {
              name:
                workspace === "governance"
                  ? "People workspace"
                  : workspace === "website"
                    ? "Website controls"
                    : "Content workspace views",
              exact: true,
            }),
          ).toBeVisible();
        await p.evaluate(() => document.fonts.ready);
        await p.addScriptTag({ path: axe });
        const checks = await p.evaluate(async () => {
          const a = (
            window as unknown as {
              axe: {
                run: (
                  o: unknown,
                ) => Promise<{
                  violations: { id: string; nodes: { target: string[] }[] }[];
                }>;
              };
            }
          ).axe;
          const results = await a.run({
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          });
          return {
            width: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            violations: results.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          };
        });
        assert.equal(checks.width, width);
        assert.equal(checks.overflow, false);
        assert.equal(checks.violations.length, 0, JSON.stringify(checks));
        const file = path.split("/").at(-1) + "-" + width + ".png";
        await p.screenshot({ path: dir + "/" + file, fullPage: true });
        views.push({ path, ...checks, file });
      }
    }
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(base + "/admin/workspaces/governance");
    await p
      .getByRole("combobox", { name: "Show", exact: true })
      .selectOption("association");
    await expect(
      p.getByRole("button", { name: new RegExp(profile.name) }),
    ).toBeVisible();
    await p.getByRole("button", { name: new RegExp(profile.name) }).click();
    await expect(
      p.getByRole("textbox", { name: /Biography heading/ }),
    ).toHaveValue("Career and contribution");
    await p.goto(base + "/admin/workspaces/website");
    await expect(p).toHaveURL(base + "/admin/workspaces/website");
    await p.getByRole("tab", { name: "Homepage", exact: true }).click();
    await p.getByRole("combobox", { name: "Settings group", exact: true }).selectOption("copy");
    await p.locator("summary").filter({ hasText: /^Copy$/ }).click();
    const title = p.getByRole("textbox", {
      name: "Hero · Heading line 1",
      exact: true,
    });
    await expect(title).toHaveValue("Managed homepage headline");
    await title.fill("UI managed homepage");
    await p.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Draft saved");
    await p.reload();
    await p.getByRole("tab", { name: "Homepage", exact: true }).click();
    await p.getByRole("combobox", { name: "Settings group", exact: true }).selectOption("copy");
    await p.locator("summary").filter({ hasText: /^Copy$/ }).click();
    await expect(title).toHaveValue("UI managed homepage");
    await p
      .getByRole("button", { name: "Publish saved draft", exact: true })
      .click();
    await expect(p.getByRole("status")).toContainText("Published");
    await p.goto(base + "/");
    await expect(p.getByRole("heading", { level: 1 })).toContainText(
      "UI managed homepage",
    );
    await p.screenshot({
      path: dir + "/public-home-managed.png",
      fullPage: true,
    });
    await p.goto(base + "/admin/workspaces/content");
    await p.getByRole("button", { name: /^Synthetic page/ }).click();
    await p.getByRole("textbox", { name: "Title", exact: true }).fill("Synthetic browser page");
    await p.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Draft saved");
    await p.reload();
    await p.getByRole("button", { name: /^Synthetic browser page/ }).click();
    await expect(p.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Synthetic browser page");
    await p.getByRole("tab", { name: "Preview", exact: true }).click();
    await expect(p.locator("iframe").first()).toBeVisible();
    await p.screenshot({ path: dir + "/content-preview.png", fullPage: true });
    await p.getByRole("tab", { name: "Edit", exact: true }).click();
    await p.getByRole("button", { name: "Publish saved draft", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Published on the public site");
    assert.ok((await (await fetch(base + "/about")).text()).includes("Synthetic browser page"));
    await p.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(p.getByRole("button", { name: "Unpublish", exact: true })).toBeHidden();
    await p.getByRole("button", { name: "Archive entry", exact: true }).click();
    await expect(p.getByRole("button", { name: "Restore entry", exact: true })).toBeVisible();
    await p.getByRole("button", { name: "Restore entry", exact: true }).click();
    await expect(p.getByRole("button", { name: "Archive entry", exact: true })).toBeVisible();
    const restoredContent = (await request("/api/staff/content")).find((entry: {id:string}) => entry.id === page.id);
    assert.equal(restoredContent.published, null);
    pass("Actual Content editor saves/reloads, previews, publishes, withdraws, archives and restores privately");

    await p.goto(base + "/admin/workspaces/media");
    const { default: sharp } = await import("sharp");
    const syntheticImage = await sharp({ create: { width: 80, height: 40, channels: 4, background: "#315d7a" } }).png().toBuffer();
    await p.locator('input[type="file"]').setInputFiles({ name: "synthetic-qa.png", mimeType: "image/png", buffer: syntheticImage });
    await p.getByRole("textbox", { name: "Title", exact: true }).fill("Synthetic browser image");
    await p.getByRole("textbox", { name: "Category", exact: true }).fill("Synthetic QA");
    await p.getByRole("textbox", { name: "Accessible image description", exact: true }).fill("A synthetic solid blue rectangle");
    await p.getByRole("button", { name: "Upload private draft", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Image saved privately");
    await p.getByRole("textbox", { name: "Title", exact: true }).fill("Synthetic browser image revised");
    await p.getByRole("button", { name: "Save draft details", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Draft details saved");
    await p.getByRole("button", { name: "Publish saved image and description", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("now public");
    await p.reload();
    await p.getByRole("button", { name: /^Synthetic browser image revised/ }).click();
    await expect(p.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Synthetic browser image revised");
    await p.getByRole("button", { name: "Unpublish image", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("Public access is closed");
    pass("Actual Media library uploads to isolated storage, saves descriptions, publishes, reloads and withdraws");
    assert.deepEqual(errors, []);
    pass(
      "Actual admin browser saves, reloads and publishes homepage; people heading and desktop/tablet/phone accessibility pass",
    );
  }
  await writeFile(
    dir + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
        syntheticOnly: true,
        productionWrites: 0,
        externalEmails: 0,
        mockStorage: true,
        scenarios,
        views,
      },
      null,
      2,
    ),
  );
  console.log("Evidence: " + dir);
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    await diagnosticPage.screenshot({ path: dir + "/first-failure.png", fullPage: true }).catch(() => {});
    await writeFile(dir + "/first-failure.json", JSON.stringify({ url: diagnosticPage.url(), body: await diagnosticPage.locator("body").innerText().catch(() => ""), browserErrors, error: String(error), syntheticOnly: true }, null, 2));
  }
  throw error;
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    if (server.exitCode === null)
      await new Promise((r) => server!.once("exit", r));
  }
  await new Promise<void>((r) => (storage ? storage.close(() => r()) : r()));
  await db.end();
  if (created) await root.query("DROP DATABASE " + name + " WITH (FORCE)");
  await root.end();
}
