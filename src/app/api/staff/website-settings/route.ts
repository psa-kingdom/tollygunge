import { getDatabase } from "@/lib/database";
import {
  websiteDefaults,
  settingsBody,
  type SettingsKey,
} from "@/domain/website-settings";
import { record, version } from "@/domain/operations";
import {
  operation,
  authorized,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
function keyOf(value: unknown): SettingsKey {
  if (value !== "shared" && value !== "home")
    throw new OperationError("Choose website settings or homepage.");
  return value;
}
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "content:publish");
    const key = keyOf(new URL(request.url).searchParams.get("key") ?? "shared");
    const row = (
      await getDatabase().query(
        "SELECT * FROM tpa.website_settings WHERE key=$1",
        [key],
      )
    ).rows[0];
    const history = (
      await getDatabase().query(
        "SELECT version,action,created_at FROM tpa.website_revisions WHERE entity=$1 ORDER BY id DESC LIMIT 30",
        ["settings:" + key],
      )
    ).rows;
    return {
      ...(row ?? {
        key,
        draft: websiteDefaults[key],
        published: null,
        version: 0,
      }),
      history,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true),
      input = record(await jsonBody(request, 128000)),
      key = keyOf(input.key),
      expected = version(input.version),
      action = String(input.action);
    if (!["save", "publish", "withdraw"].includes(action))
      throw new OperationError("Choose save, publish or withdraw.");
    return transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM tpa.website_settings WHERE key=$1 FOR UPDATE",
          [key],
        )
      ).rows[0];
      if ((row?.version ?? 0) !== expected)
        throw new OperationError(
          "Settings changed. Reload before continuing.",
          409,
        );
      if (action !== "save" && !row)
        throw new OperationError("Save the settings first.");
      const body =
        action === "save" ? settingsBody(key, input.body) : row.draft;
      if (
        "logoMediaId" in body &&
        body.logoMediaId &&
        !(
          await c.query(
            "SELECT 1 FROM tpa.public_media WHERE id=$1 AND published IS NOT NULL",
            [body.logoMediaId],
          )
        ).rowCount
      )
        throw new OperationError(
          "Choose a published media image for the logo.",
        );
      const result =
        action === "save"
          ? (
              await c.query(
                "INSERT INTO tpa.website_settings(key,draft,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET draft=$2,version=tpa.website_settings.version+1,updated_by=$3,updated_at=now() RETURNING *",
                [key, body, actor.id],
              )
            ).rows[0]
          : (
              await c.query(
                `UPDATE tpa.website_settings SET published=${action === "publish" ? "draft" : "NULL"},version=version+1,updated_by=$2,updated_at=now() WHERE key=$1 RETURNING *`,
                [key, actor.id],
              )
            ).rows[0];
      await c.query(
        "INSERT INTO tpa.website_revisions(entity,version,action,body,actor_id) VALUES($1,$2,$3,$4,$5)",
        ["settings:" + key, result.version, action, result.draft, actor.id],
      );
      await audit(c, actor.id, "website.settings." + action, key);
      return result;
    });
  });
}
