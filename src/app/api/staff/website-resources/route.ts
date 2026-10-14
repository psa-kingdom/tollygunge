import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { resourceBody } from "@/domain/website-settings";
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
    const params = new URL(request.url).searchParams,
      kind = params.get("kind") ?? "link";
    if (!["link", "document"].includes(kind))
      throw new OperationError("Choose links or downloads.");
    if (params.has("id")) {
      const id = uuid(params.get("id"));
      const resource = (
        await getDatabase().query(
          "SELECT * FROM tpa.website_resources WHERE id=$1 AND kind=$2",
          [id, kind],
        )
      ).rows[0];
      if (!resource) throw new OperationError("Resource not found.", 404);
      const history = (
        await getDatabase().query(
          "SELECT version,action,body,created_at FROM tpa.website_revisions WHERE entity=$1 ORDER BY id DESC LIMIT 30",
          [id],
        )
      ).rows;
      return { resource, history };
    }
    return (
      await getDatabase().query(
        "SELECT * FROM tpa.website_resources WHERE kind=$1 AND ($2 OR archived_at IS NULL) ORDER BY (draft->>'order')::int,id",
        [kind, params.get("archived") === "true"],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      input = record(await jsonBody(request)),
      id = input.id ? uuid(input.id) : randomUUID(),
      expected = version(input.version),
      kind = String(input.kind),
      action = String(input.action);
    if (
      !["link", "document"].includes(kind) ||
      !["save", "publish", "withdraw", "archive", "restore"].includes(action)
    )
      throw new OperationError("Choose a resource action.");
    return transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM tpa.website_resources WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if ((row?.version ?? 0) !== expected || (row && row.kind !== kind))
        throw new OperationError(
          "Resource changed. Reload before continuing.",
          409,
        );
      if (!row && action !== "save")
        throw new OperationError("Save this resource first.");
      if (row?.archived_at && action !== "restore")
        throw new OperationError("Restore this resource before editing.", 409);
      const body =
        action === "save" ? resourceBody(input.body, kind) : row.draft;
      if (
        action === "publish" &&
        kind === "document" &&
        !body.fileId &&
        !body.url
      )
        throw new OperationError(
          "Upload a PDF or provide a document link before publishing.",
        );
      if (
        body.fileId &&
        !(
          await c.query(
            "SELECT 1 FROM tpa.website_resource_files WHERE id=$1 AND resource_id=$2",
            [body.fileId, id],
          )
        ).rowCount
      )
        throw new OperationError("Choose a PDF uploaded to this download.");
      const result =
        action === "save"
          ? (
              await c.query(
                "INSERT INTO tpa.website_resources(id,kind,draft,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET draft=$3,version=tpa.website_resources.version+1,updated_by=$4,updated_at=now() RETURNING *",
                [id, kind, body, actor.id],
              )
            ).rows[0]
          : (
              await c.query(
                `UPDATE tpa.website_resources SET published=${action === "publish" ? "draft" : action === "restore" ? "published" : "NULL"},archived_at=${action === "archive" ? "now()" : action === "restore" ? "NULL" : "archived_at"},version=version+1,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING *`,
                [id, actor.id],
              )
            ).rows[0];
      await c.query(
        "INSERT INTO tpa.website_revisions(entity,version,action,body,actor_id) VALUES($1,$2,$3,$4,$5)",
        [id, result.version, action, result.draft, actor.id],
      );
      await audit(c, actor.id, "website.resource." + action, id);
      return result;
    });
  });
}
