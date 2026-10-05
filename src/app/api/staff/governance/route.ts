import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { governanceProfile } from "@/domain/governance";
import { record, uuid, version } from "@/domain/operations";
import {
  operation,
  authorized,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "content:publish");
    const records = (
      await getDatabase().query(
        "SELECT g.*,(SELECT coalesce(json_agg(r ORDER BY r.version DESC),'[]') FROM tpa.governance_revisions r WHERE r.profile_id=g.id) AS history FROM tpa.governance_profiles g ORDER BY updated_at DESC LIMIT 200",
      )
    ).rows;
    const portraits = (
      await getDatabase().query(
        "SELECT id,published->>'title' AS title FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC LIMIT 200",
      )
    ).rows;
    return { records, portraits };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      input = record(await jsonBody(request, 12000)),
      expected = version(input.version);
    if (!["save", "publish", "unpublish"].includes(String(input.action)))
      throw new OperationError("Choose a profile action.");
    return transaction(async (client) => {
      const id = input.id ? uuid(input.id) : randomUUID();
      const current = input.id
        ? (
            await client.query(
              "SELECT * FROM tpa.governance_profiles WHERE id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0]
        : null;
      if (input.id ? !current || current.version !== expected : expected !== 0)
        throw new OperationError(
          "This profile changed. Reload before saving.",
          409,
        );
      if (input.action !== "save" && !current)
        throw new OperationError("Save the profile first.");
      const body =
        input.action === "save"
          ? governanceProfile(input.body)
          : governanceProfile(current.draft);
      if (
        body.portraitId &&
        input.action !== "unpublish" &&
        !(
          await client.query(
            "SELECT 1 FROM tpa.public_media WHERE id=$1 AND published IS NOT NULL FOR SHARE",
            [body.portraitId],
          )
        ).rowCount
      )
        throw new OperationError(
          "Choose an explicitly published editorial portrait.",
        );
      if (input.action === "publish" && input.confirmPublication !== true)
        throw new OperationError(
          "Confirm association details and permission to publish.",
        );
      const row = current
        ? (
            await client.query(
              "UPDATE tpa.governance_profiles SET draft=$2,published=CASE WHEN $3='publish' THEN $2::jsonb WHEN $3='unpublish' THEN NULL ELSE published END,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 RETURNING *",
              [id, body, input.action, actor.id],
            )
          ).rows[0]
        : (
            await client.query(
              "INSERT INTO tpa.governance_profiles(id,draft,updated_by) VALUES($1,$2,$3) RETURNING *",
              [id, body, actor.id],
            )
          ).rows[0];
      await client.query(
        "INSERT INTO tpa.governance_revisions(profile_id,version,action,body,actor_id) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          row.version,
          input.action === "save"
            ? "saved"
            : input.action === "publish"
              ? "published"
              : "unpublished",
          body,
          actor.id,
        ],
      );
      await audit(client, actor.id, `governance.${input.action}`, id);
      return row;
    });
  });
}
