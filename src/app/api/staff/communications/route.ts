import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { recoveryConfigured } from "@/lib/auth-email";
import { record, text, uuid, version } from "@/domain/operations";
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
    await authorized(request, "communications:manage");
    return {
      templates: (
        await getDatabase().query(
          "SELECT * FROM tpa.communication_templates ORDER BY updated_at DESC LIMIT 100",
        )
      ).rows,
      optedIn: (
        await getDatabase().query(
          "SELECT count(*)::int AS n FROM tpa.newsletter_consents WHERE subscribed=true",
        )
      ).rows[0].n,
      provider: "Resend",
      deliveryEnabled: false,
      recoveryEnabled: recoveryConfigured(),
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "communications:manage", true),
      input = record(await jsonBody(request, 10000));
    if (input.action !== "save")
      throw new OperationError(
        "Campaign delivery awaits consent-safe jobs and delivery-event handling.",
        409,
      );
    const id = input.id ? uuid(input.id) : randomUUID(),
      expected = version(input.version),
      name = text(input.name, "Template name", 100, 3),
      subject = text(input.subject, "Subject", 160, 3),
      body = text(input.body, "Body", 6000, 10);
    return transaction(async (client) => {
      const result = input.id
        ? await client.query(
            "UPDATE tpa.communication_templates SET name=$3,subject=$4,body=$5,version=version+1,updated_by=$6,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *",
            [id, expected, name, subject, body, actor.id],
          )
        : await client.query(
            "INSERT INTO tpa.communication_templates(id,name,subject,body,updated_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [id, name, subject, body, actor.id],
          );
      if (!result.rowCount)
        throw new OperationError(
          "Template changed. Reload before saving.",
          409,
        );
      await audit(client, actor.id, "communication.template_saved", id);
      return result.rows[0];
    });
  });
}
