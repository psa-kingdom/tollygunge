/** Seed clearly labelled publishing examples into an isolated local preview only.
 * Run with the preview's env file and TPA_TEST_URL=http://localhost:3200.
 * Existing demo records are retained, so running this twice creates no duplicates.
 */
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { jsPDF } from "jspdf";
const base = process.env.TPA_TEST_URL;
function loopback(value: string | undefined) {
  return (
    !!value &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)
  );
}
if (
  !loopback(base) ||
  !loopback(process.env.DATABASE_URL) ||
  !loopback(process.env.TPA_LOCAL_STORAGE_ENDPOINT) ||
  process.env.TPA_MAIL_SINK !== "true"
)
  throw Error(
    "Demo seeding requires a loopback app, database and storage, with the local mail sink enabled.",
  );
if (!process.env.BETTER_AUTH_SECRET)
  throw Error("Local authentication is required.");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
type Row = {
  id: string;
  version: number;
  draft: Record<string, unknown>;
  published: unknown;
};
const sessionId = randomUUID(),
  token = randomBytes(32).toString("hex");
const cookie =
  "better-auth.session_token=" +
  encodeURIComponent(
    token +
      "." +
      createHmac("sha256", process.env.BETTER_AUTH_SECRET)
        .update(token)
        .digest("base64"),
  );
async function api<T = Row>(
  path: string,
  body?: Record<string, unknown> | FormData,
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      origin: base!,
      ...(body && !multipart ? { "content-type": "application/json" } : {}),
    },
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      `${path}: ${response.status} ${result.error ?? "request failed"}`,
    );
  return result;
}
try {
  let actor = (
    await db.query('SELECT id FROM public."user" WHERE email=$1', [
      "publishing-demo@example.invalid",
    ])
  ).rows[0];
  if (!actor) {
    actor = { id: randomUUID() };
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [actor.id, "Local publishing demo", "publishing-demo@example.invalid"],
    );
    await db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'content_editor')",
      [actor.id],
    );
  }
  await db.query(
    'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'20 minutes\',now())',
    [sessionId, token, actor.id],
  );
  const imageIds: string[] = [];
  for (const [i, file] of [
    "book-knowledge-watercolor.webp",
    "book-community-watercolor.webp",
  ].entries()) {
    const title = i
      ? "DEMO · Community illustration"
      : "DEMO · Knowledge illustration";
    let row = (
      await db.query(
        "SELECT id,version,published FROM tpa.public_media WHERE draft->>'title'=$1 AND uploaded_by=$2",
        [title, actor.id],
      )
    ).rows[0];
    if (!row) {
      const bytes = await sharp(
        await readFile(new URL("../public/design/" + file, import.meta.url)),
      )
        .png()
        .toBuffer();
      const form = new FormData();
      form.set(
        "file",
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        `demo-${i + 1}.png`,
      );
      form.set("title", title);
      form.set("category", "Local testing");
      form.set(
        "altText",
        i
          ? "Sample community illustration for local website testing"
          : "Sample books illustration for local website testing",
      );
      form.set("displayOrder", String(9000 + i));
      row = await api("/api/staff/media", form);
    }
    row = (
      await db.query(
        "SELECT id,version,published FROM tpa.public_media WHERE id=$1",
        [row.id],
      )
    ).rows[0];
    if (!row.published)
      await api("/api/staff/media", {
        action: "publish",
        id: row.id,
        version: row.version,
      });
    imageIds.push(row.id);
  }
  const articles = [
    {
      slug: "demo-learning-community",
      title: "DEMO · A community that learns together",
      intro:
        "Sample article for local testing. Explore how a short community update appears on the Resources page.",
      section: "Learning together",
      text: "This is fictional sample copy for testing the publishing workspace. A sample learning circle might invite participants to share an idea, discuss a practical challenge and suggest a topic for a future session.\n\nUse this article to try headings, paragraphs, links and preview widths. Replace the copy with your own draft, then review it before publishing.",
      publish: true,
    },
    {
      slug: "demo-event-preparation",
      title: "DEMO · Preparing for an association event",
      intro:
        "Sample content only. This article is designed to test longer titles, cover images and multiple sections.",
      section: "Before the session",
      text: "This demonstration article is not an actual event announcement. Imagine a community session with a welcome, a short presentation and time for discussion.\n\nA clear update gives readers a purpose, an outline and an easy next step. Edit this sample to test the article editor and website preview.",
      publish: true,
    },
    {
      slug: "demo-resource-reading-list",
      title: "DEMO · Finding useful professional resources",
      intro:
        "A fictional reading-list article for testing navigation from Resources to an individual article.",
      section: "A sample reading list",
      text: "This local demonstration contains no professional advice. It provides sample text for testing article layouts, search, editing and publication.\n\nTry adding a section, selecting a cover image or changing the summary. The separate downloads and important links on Resources can also be edited from Website pages.",
      publish: true,
    },
    {
      slug: "demo-volunteer-story-draft",
      title: "DEMO · A volunteer story in progress",
      intro:
        "Private draft sample. This entry should appear in the article library but not on the public Resources page.",
      section: "Draft story",
      text: "This is a deliberately unpublished sample. Add your own fictional text to explore draft saving, formatting and previews without changing a published article.",
      publish: false,
    },
    {
      slug: "demo-news-summary-draft",
      title: "DEMO · News summary for editorial review",
      intro:
        "Private sample news summary for testing source and attribution fields.",
      section: "Summary",
      text: "This is a fictional summary for local interface testing. It is not a report of a real event or a professional update. The source points to the reserved example domain.",
      publish: false,
      kind: "news",
    },
  ];
  for (const [i, a] of articles.entries()) {
    if (
      (
        await db.query("SELECT id FROM tpa.content_entries WHERE slug=$1", [
          a.slug,
        ])
      ).rowCount
    )
      continue;
    const row = await api("/api/staff/content", {
      action: "save",
      version: 0,
      kind: a.kind ?? "insight",
      slug: a.slug,
      body: {
        title: a.title,
        intro: a.intro,
        sections: [{ title: a.section, text: a.text }],
        sourceUrl: a.kind ? "https://example.com/" : "",
        attribution: "Local demo content",
        displayOrder: 9000 + i,
        heroMediaId: imageIds[i % 2],
        heroAlt: "Demonstration illustration for local article testing",
      },
    });
    if (a.publish)
      await api("/api/staff/content", {
        action: "publish",
        id: row.id,
        version: row.version,
      });
  }
  for (const [i, title] of [
    "DEMO · Sample event checklist",
    "DEMO · Sample reading notes",
  ].entries()) {
    if (
      (
        await db.query(
          "SELECT id FROM tpa.website_resources WHERE kind='document' AND draft->>'title'=$1 AND updated_by=$2",
          [title, actor.id],
        )
      ).rowCount
    )
      continue;
    let row = await api("/api/staff/website-resources", {
      action: "save",
      kind: "document",
      version: 0,
      body: {
        title,
        description:
          "A sample PDF for testing local downloads. Not an official association document.",
        order: 9000 + i,
        url: "",
        fileId: null,
      },
    });
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text(title.replace(" · ", " - "), 20, 30);
    pdf.setFontSize(12);
    pdf.text(
      [
        "LOCAL TESTING ONLY",
        "This is a fictional sample document.",
        "It is not an official association document.",
        "",
        "Use it to test download links and resource management.",
      ],
      20,
      50,
    );
    const form = new FormData();
    form.set("resourceId", row.id);
    form.set("version", String(row.version));
    form.set(
      "file",
      new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }),
      `demo-resource-${i + 1}.pdf`,
    );
    row = await api("/api/staff/website-resource-files", form);
    await api("/api/staff/website-resources", {
      action: "publish",
      kind: "document",
      id: row.id,
      version: row.version,
    });
  }
  for (const [i, title] of [
    "DEMO · Example reference website",
    "DEMO · Example reading link",
  ].entries()) {
    if (
      (
        await db.query(
          "SELECT id FROM tpa.website_resources WHERE kind='link' AND draft->>'title'=$1 AND updated_by=$2",
          [title, actor.id],
        )
      ).rowCount
    )
      continue;
    const row = await api("/api/staff/website-resources", {
      action: "save",
      kind: "link",
      version: 0,
      body: {
        title,
        description:
          "Placeholder link to the reserved example domain, for local testing only.",
        order: 9000 + i,
        url: "https://example.com/",
        fileId: null,
      },
    });
    await api("/api/staff/website-resources", {
      action: "publish",
      kind: "link",
      id: row.id,
      version: row.version,
    });
  }
  console.log(
    "Local publishing demos ready: 3 published articles, 2 draft articles, 2 images, 2 PDF downloads and 2 reference links.",
  );
} finally {
  await db.query('DELETE FROM public."session" WHERE id=$1', [sessionId]);
  await db.end();
}
