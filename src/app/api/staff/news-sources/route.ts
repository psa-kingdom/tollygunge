import { randomUUID } from "node:crypto";
import { record, text, uuid, version, webLink } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish"),
      id = new URL(request.url).searchParams.get("id");
    const sources = (
      await getDatabase().query(
        "SELECT * FROM tpa.news_sources ORDER BY updated_at DESC,id",
      )
    ).rows;
    const revisions = id
      ? (
          await getDatabase().query(
            'SELECT r.version,r.action,r.snapshot,r.created_at,u.name AS actor_name FROM tpa.news_source_revisions r JOIN public."user" u ON u.id=r.actor_user_id WHERE r.source_id=$1 ORDER BY r.version DESC LIMIT 50',
            [uuid(id)],
          )
        ).rows
      : [];
    return {
      sources,
      revisions,
      administrator: actor.roles.includes("administrator"),
      collectionEnabled: false,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      input = record(await jsonBody(request, 12000)),
      expected = version(input.version),
      id = input.id ? uuid(input.id) : randomUUID();
    if (
      !["save", "approve", "pause"].includes(String(input.action)) ||
      (!input.id && (expected !== 0 || input.action !== "save"))
    )
      throw new OperationError("Save a source draft first.");
    if (input.action !== "save" && !actor.roles.includes("administrator"))
      throw new OperationError("Administrators approve or pause sources.", 403);
    const details =
      input.action === "save"
        ? {
            name: text(input.name, "Source name", 160, 1),
            url: webLink(input.url, true),
            type: text(input.type, "Source type", 10, 1),
            notes: text(input.notes ?? "", "Editorial notes", 3000),
          }
        : undefined;
    if (details && !["website", "rss"].includes(details.type))
      throw new OperationError("Choose website or RSS.");
    return transaction(async (client) => {
      if (input.id) {
        const row = (
          await client.query(
            "SELECT version,status FROM tpa.news_sources WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!row) throw new OperationError("Source not found.", 404);
        if (row.version !== expected)
          throw new OperationError(
            "Source changed. Reload before editing.",
            409,
          );
        if (
          (input.action === "approve" && row.status !== "draft") ||
          (input.action === "pause" && row.status !== "approved")
        )
          throw new OperationError("Source state changed. Reload first.", 409);
      }
      const source = !input.id
        ? (
            await client.query(
              "INSERT INTO tpa.news_sources(id,name,url,type,notes,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
              [
                id,
                details!.name,
                details!.url,
                details!.type,
                details!.notes,
                actor.id,
              ],
            )
          ).rows[0]
        : input.action === "save"
          ? (
              await client.query(
                "UPDATE tpa.news_sources SET name=$2,url=$3,type=$4,notes=$5,status='draft',version=version+1,updated_by=$6,updated_at=now() WHERE id=$1 RETURNING *",
                [
                  id,
                  details!.name,
                  details!.url,
                  details!.type,
                  details!.notes,
                  actor.id,
                ],
              )
            ).rows[0]
          : (
              await client.query(
                "UPDATE tpa.news_sources SET status=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *",
                [
                  id,
                  input.action === "approve" ? "approved" : "paused",
                  actor.id,
                ],
              )
            ).rows[0];
      await client.query(
        "INSERT INTO tpa.news_source_revisions(source_id,version,snapshot,action,actor_user_id) VALUES($1,$2,$3,$4,$5)",
        [id, source.version, source, input.action, actor.id],
      );
      await audit(client, actor.id, `news_source.${input.action}`, id);
      return { source, collectionEnabled: false };
    });
  });
}
