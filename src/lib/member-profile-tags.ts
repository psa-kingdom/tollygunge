import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { text, uuid } from "@/domain/operations";
import { audit, OperationError } from "./operation-api";

export async function saveMemberProfileTag(
  client: PoolClient,
  actorId: string,
  input: Record<string, unknown>,
) {
  const personId = input.personId == null ? null : uuid(input.personId);
  const accountId = input.userId == null ? null : text(input.userId, "Account ID", 200, 1);
  if (!personId && !accountId) throw new OperationError("Choose a profile.");

  // Serialize edits for accounts even before they get a person record.
  if (accountId && !(await client.query(
    'SELECT id FROM public."user" WHERE id=$1 FOR UPDATE', [accountId],
  )).rowCount) throw new OperationError("Profile not found.", 404);
  const { rows: [person] } = await client.query(
    `SELECT id,user_id,archived_at FROM tpa.people
     WHERE ($1::uuid IS NOT NULL AND id=$1) OR ($1::uuid IS NULL AND user_id=$2)
     FOR UPDATE`,
    [personId, accountId],
  );
  if (personId && (!person || person.user_id !== accountId))
    throw new OperationError("Profile changed. Reopen it before editing tags.", 409);
  if (person?.archived_at) throw new OperationError("Restore this profile before editing tags.", 409);

  let tagId: string;
  if (input.action === "profile-tag.create") {
    const name = text(typeof input.name === "string" ? input.name.replace(/\s+/g, " ") : input.name, "Tag name", 60, 1);
    const result = await client.query(
      "INSERT INTO tpa.member_profile_tags(id,name) VALUES($1,$2) ON CONFLICT (lower(name)) DO NOTHING RETURNING id",
      [randomUUID(), name],
    );
    if (result.rowCount) {
      tagId = result.rows[0].id;
      await audit(client, actorId, "profile_tag.created", tagId);
    } else {
      tagId = (await client.query("SELECT id FROM tpa.member_profile_tags WHERE lower(name)=lower($1)", [name])).rows[0].id;
    }
  } else {
    tagId = uuid(input.tagId);
    if (!(await client.query("SELECT 1 FROM tpa.member_profile_tags WHERE id=$1", [tagId])).rowCount)
      throw new OperationError("Tag not found.", 404);
  }

  const profile = [tagId, person?.id ?? null, accountId];
  const removing = input.action === "profile-tag.remove";
  const change = removing
    ? await client.query(
      "DELETE FROM tpa.member_profile_tag_assignments WHERE tag_id=$1 AND (person_id=$2 OR user_id=$3)",
      profile,
    )
    : await client.query(
      `INSERT INTO tpa.member_profile_tag_assignments(tag_id,person_id,user_id)
       SELECT $1::uuid,$2::uuid,CASE WHEN $2::uuid IS NULL THEN $3::text END
       WHERE NOT EXISTS (
         SELECT 1 FROM tpa.member_profile_tag_assignments WHERE tag_id=$1 AND (person_id=$2 OR user_id=$3)
       ) ON CONFLICT DO NOTHING`,
      profile,
    );
  if (change.rowCount)
    await audit(client, actorId, removing ? "profile_tag.removed" : "profile_tag.assigned", person?.id ?? accountId);
  const { rows: tags } = await client.query(
    `SELECT id,name FROM tpa.member_profile_tags WHERE id IN (
       SELECT tag_id FROM tpa.member_profile_tag_assignments WHERE person_id=$1 OR user_id=$2
     ) ORDER BY lower(name),id`,
    [person?.id ?? null, accountId],
  );
  return { tags };
}
