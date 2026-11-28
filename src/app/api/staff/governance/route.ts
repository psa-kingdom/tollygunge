import { getDatabase } from "@/lib/database";
import { editorialProfileFields, personBody, redactPerson } from "@/domain/people";
import { record, uuid } from "@/domain/operations";
import {publishedSettings} from '@/lib/website-content';
import { publishedPeople } from "@/lib/public-people";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import {
  staffPeople,
  privatePeople,
  admin,
  enriched,
  changePerson,
} from "@/lib/people-service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!staffPeople(actor)) throw new OperationError("Access denied.", 403);
    const client = await getDatabase().connect();
    try {
      const params = new URL(request.url).searchParams;
      const value = params.get("id");
      const id = value ? uuid(value) : null;
      const paginated = params.has("page");
      const page = Number(params.get("page") ?? 1);
      const search = (params.get("q") ?? "").trim();
      const filter = params.get("filter") ?? "all";
      if (!Number.isSafeInteger(page) || page < 1 || search.length > 200 || !["all","association","pending","unverified","verified","rejected","published","archived"].includes(filter)) throw new OperationError("Choose valid directory filters.");
      const where = `p.directory_deleted_at IS NULL AND p.publishing_deleted_at IS NULL AND ($1::uuid IS NULL OR p.id=$1) AND ($1::uuid IS NOT NULL OR CASE WHEN $2='archived' THEN p.archived_at IS NOT NULL ELSE p.archived_at IS NULL END)
        AND ($1::uuid IS NOT NULL OR $2 IN ('all','archived') OR ($2='association' AND (p.published IS NOT NULL OR jsonb_array_length(coalesce(p.draft->'assignments','[]'))>0)) OR ($2='published' AND p.published IS NOT NULL) OR p.status=$2)
        AND ($3='' OR strpos(lower(concat_ws(' ',p.draft->>'name',p.draft->>'organization',p.draft->>'biography',p.draft->'assignments')),lower($3))>0)`;
      const args=[id,filter,search];
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const total=Number((await client.query(`SELECT count(*) n FROM tpa.people p WHERE ${where}`,args)).rows[0].n);
      const rows = (
        await client.query(
          `SELECT p.*,(SELECT m.id FROM tpa.memberships m WHERE m.person_id=p.id ORDER BY m.created_at DESC LIMIT 1) membership_id FROM tpa.people p WHERE ${where} ORDER BY p.updated_at DESC,p.id ${paginated && !id ? 'LIMIT 50 OFFSET $4' : ''}`,
          paginated && !id ? [...args,(page-1)*50] : args,
        )
      ).rows;
      const records = [];
      for (const row of rows) {
        if (id) {
          const entry = await enriched(client, row, actor);
          const published = row.published
            ? (await publishedPeople(id, client)).find(item => item.published.page === "governance")?.published
            : undefined;
          records.push({
            ...entry,
            ...(published ? { websiteContacts: { email: published.email ?? "", mobile: published.mobile ?? "" } } : {}),
          });
          continue;
        }
        records.push(
          {
                ...Object.fromEntries(
                  Object.entries(row).filter(
                    ([key]) =>
                      privatePeople(actor) ||
                      ![
                        "contact_email",
                        "mobile_normalized",
                        "editorial_approved_snapshot",
                      ].includes(key),
                  ),
                ),
                published: row.published
                  ? redactPerson(personBody(row.published))
                  : null,
                draft: privatePeople(actor)
                  ? personBody(row.draft)
                  : redactPerson(personBody(row.draft)),
                accepted: privatePeople(actor)
                  ? personBody(row.accepted)
                  : redactPerson(personBody(row.accepted)),
          },
        );
      }
      return {
        total, page, pageSize:50,
        biographyTemplate:(await publishedSettings('shared')).biographyHeading,
        records,
        groups: (
          await client.query(
            "SELECT * FROM tpa.profile_groups ORDER BY (draft->>'order')::int,id",
          )
        ).rows,
        portraits: (
          await client.query(
            "SELECT id,published->>'title' AS title FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC LIMIT 200",
          )
        ).rows,
        canReview: admin(actor),
        canEditPrivate: privatePeople(actor),
        canPublish:
          (actor.roles.includes("administrator") || actor.roles.includes("super_administrator")) ||
          actor.roles.includes("content_editor"),
      };
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    if (!staffPeople(actor)) throw new OperationError("Access denied.", 403);
    const input = await jsonBody(request, 1048576);
    if (["approve", "approve_editorial", "reject"].includes(input.action))
      throw new OperationError("Use the administrator review endpoint.");
    return transaction(async (client) => {
      if (input.action !== "publish" || input.body === undefined)
        return changePerson(client, actor, input);
      if (!admin(actor))
        throw new OperationError("Only administrators can publish unsaved website changes.", 403);
      if (input.confirmPublication !== true)
        throw new OperationError("Confirm publication of the website profile.");
      const body = Object.fromEntries(Object.entries(record(input.body))
        .filter(([field]) => field === "name" || editorialProfileFields.has(field)));
      const saved = await changePerson(client, actor, { ...input, action: "save", body });
      if (!("id" in saved) || !("version" in saved))
        throw new OperationError("Could not save the website profile.");
      return changePerson(client, actor, { ...input, id: saved.id, version: saved.version });
    });
  });
}
