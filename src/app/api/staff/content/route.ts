import { contentLimits } from "@/domain/rich-content";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { contentInput, record, uuid, version } from "@/domain/operations";
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
    return (
      await getDatabase().query(
        "SELECT * FROM tpa.content_entries WHERE ($1 OR archived_at IS NULL) ORDER BY updated_at DESC,id",
        [new URL(request.url).searchParams.get('archived')==='true'],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      raw = record(await jsonBody(request, contentLimits.requestBytes));
    return transaction(async (client) => {
      if (['publish','unpublish','archive','restore'].includes(String(raw.action))) {
        const id = uuid(raw.id),
          expected = version(raw.version);
        const result = await client.query(
          `UPDATE tpa.content_entries SET published=${raw.action === "publish" ? "draft" : "NULL"},published_at=${raw.action === "publish" ? "now()" : "NULL"},archived_at=${raw.action==='archive'?'now()':raw.action==='restore'?'NULL':'archived_at'},version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 AND version=$2 AND (archived_at IS NULL OR $4='restore') RETURNING *`,
          [id, expected, actor.id,raw.action],
        );
        if (!result.rowCount)
          throw new OperationError(
            "This entry changed. Reload before publishing.",
            409,
          );
        const row = result.rows[0];
        await client.query(
          "INSERT INTO tpa.content_revisions(entry_id,version,body,actor_id,action) VALUES($1,$2,$3,$4,$5)",
          [
            id,
            row.version,
            row.draft,
            actor.id,
            raw.action === "publish" ? "published" : raw.action === "unpublish" ? "unpublished" : raw.action,
          ],
        );
        await audit(client, actor.id, `content.${raw.action}`, id);
        return row;
      }
      if (raw.action !== "save")
        throw new OperationError("Invalid content action.");
      const input = contentInput(raw),
        id = input.id ?? randomUUID();
      const result = input.id
        ? await client.query(
            "UPDATE tpa.content_entries SET draft=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 AND version=$2 AND kind=$5 AND slug=$6 AND archived_at IS NULL RETURNING *",
            [id, input.version, input.body, actor.id, input.kind, input.slug],
          )
        : await client.query(
            "INSERT INTO tpa.content_entries(id,slug,kind,draft,updated_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [id, input.slug, input.kind, input.body, actor.id],
          );
      if (!result.rowCount)
        throw new OperationError(
          "This entry changed. Reload before saving.",
          409,
        );
      const row = result.rows[0];
      await client.query(
        "INSERT INTO tpa.content_revisions(entry_id,version,body,actor_id,action) VALUES($1,$2,$3,$4,'saved')",
        [id, row.version, input.body, actor.id],
      );
      await audit(client, actor.id, "content.saved", id);
      return row;
    });
  });
}
