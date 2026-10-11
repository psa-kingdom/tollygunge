import { randomUUID } from "node:crypto";
import { permittedReports, reportName, reportFilters } from "@/domain/reports";
import { record, text, uuid, version } from "@/domain/operations";
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
    const actor = await authorized(request);
    if (!actor.roles.length)
      throw new OperationError("Staff access required.", 403);
    return {
      presets: (
        await getDatabase().query(
          "SELECT id,name,visibility,report,filters,version,updated_at,owner_user_id=$1 AS owned FROM tpa.report_presets WHERE (owner_user_id=$1 OR visibility='shared') AND report=ANY($2::text[]) ORDER BY visibility,name,id",
          [actor.id, permittedReports(actor.roles)],
        )
      ).rows,
      administrator: actor.roles.includes("administrator"),
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    if (!actor.roles.length)
      throw new OperationError("Staff access required.", 403);
    const input = record(await jsonBody(request, 12000)),
      expected = version(input.version),
      id = input.id ? uuid(input.id) : randomUUID();
    if (
      !["save", "delete"].includes(String(input.action)) ||
      (!input.id && (expected !== 0 || input.action !== "save"))
    )
      throw new OperationError("Choose a valid preset action.");
    const name =
        input.action === "save" ? text(input.name, "Preset name", 120, 1) : "",
      visibility = input.visibility;
    const report =
      input.action === "save" ? reportName(input.report) : undefined;
    const f = input.action === "save" ? record(input.filters) : {};
    if (Object.values(f).some((v) => v !== null && typeof v !== "string"))
      throw new OperationError("Check the preset filters.");
    const filters =
      input.action === "save"
        ? reportFilters(
            new URLSearchParams(
              Object.entries(f).filter(([, v]) => v !== null) as [
                string,
                string,
              ][],
            ),
          )
        : undefined;
    if (report && !permittedReports(actor.roles).includes(report))
      throw new OperationError("Access denied.", 403);
    if (
      input.action === "save" &&
      !["private", "shared"].includes(String(visibility))
    )
      throw new OperationError("Choose private or shared.");
    if (visibility === "shared" && !actor.roles.includes("administrator"))
      throw new OperationError("Administrators manage shared presets.", 403);
    return transaction(async (client) => {
      if (input.id) {
        const row = (
          await client.query(
            "SELECT * FROM tpa.report_presets WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (
          !row ||
          (row.visibility === "private"
            ? row.owner_user_id !== actor.id
            : !actor.roles.includes("administrator")) ||
          !permittedReports(actor.roles).includes(row.report)
        )
          throw new OperationError("Preset unavailable.", 403);
        if (row.version !== expected)
          throw new OperationError(
            "Preset changed. Reload before editing.",
            409,
          );
        if (input.action === "delete") {
          await client.query("DELETE FROM tpa.report_presets WHERE id=$1", [
            id,
          ]);
          await audit(client, actor.id, "report_preset.delete", id);
          return { deleted: true };
        }
        if (row.visibility !== visibility)
          throw new OperationError(
            "Create a separate preset to change visibility.",
          );
      }
      const row = !input.id
        ? (
            await client.query(
              "INSERT INTO tpa.report_presets(id,owner_user_id,name,visibility,report,filters) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
              [id, actor.id, name, visibility, report, filters],
            )
          ).rows[0]
        : (
            await client.query(
              "UPDATE tpa.report_presets SET name=$2,report=$3,filters=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
              [id, name, report, filters],
            )
          ).rows[0];
      await audit(client, actor.id, "report_preset.save", id);
      return { preset: row };
    });
  });
}
