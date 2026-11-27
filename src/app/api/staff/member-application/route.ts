import { addressKeys } from "@/domain/address";
import { validateAnswers, type VerificationField } from "@/domain/verification";
import { getDatabase } from "@/lib/database";
import {
  audit,
  authorized,
  jsonBody,
  operation,
  OperationError,
  transaction,
} from "@/lib/operation-api";
import { validatePostalAddresses } from "@/lib/postal-directory";

const draftQuery = `
  SELECT d.id, d.version, d.plan, d.category, d.details, p.fields
  FROM tpa.application_drafts d
  JOIN tpa.verification_policies p ON p.version = d.requirement_version
  WHERE d.user_id = $1
`;

function editable(field: VerificationField) {
  return field.type !== "document" && field.id !== "declaration";
}

function accountId(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 200)
    throw new OperationError("Choose a member account.");
  return value;
}

export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "staff:manage");
    const userId = accountId(new URL(request.url).searchParams.get("userId"));
    const { rows } = await getDatabase().query(draftQuery, [userId]);
    const draft = rows[0];
    return draft
      ? {
          ...draft,
          editableIds: (draft.fields as VerificationField[])
            .filter(editable)
            .map((field) => field.id),
        }
      : null;
  });
}

export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage", true);
    const input = await jsonBody(request, 128000);
    const userId = accountId(input?.userId);
    if (
      !input.changes ||
      typeof input.changes !== "object" ||
      Array.isArray(input.changes)
    )
      throw new OperationError("Check the application fields.");

    return transaction(async (client) => {
      const { rows } = await client.query(draftQuery + " FOR UPDATE OF d", [
        userId,
      ]);
      const draft = rows[0];
      if (!draft) throw new OperationError("Application not found.", 404);
      if (draft.version !== input.version)
        throw new OperationError(
          "The application changed. Reopen the member record before saving.",
          409,
        );

      const fields: VerificationField[] = draft.fields;
      const allowed = new Set(fields.filter(editable).map((field) => field.id));
      for (const key of addressKeys)
        if (allowed.has(key)) allowed.add(key + "Structured");
      const changes = Object.entries(input.changes);
      if (
        !changes.length ||
        changes.some(
          ([key, value]) => !allowed.has(key) || typeof value !== "string",
        )
      )
        throw new OperationError("Choose editable application fields.");

      const details = validateAnswers(
        { ...draft.details, ...input.changes },
        fields,
        draft.details,
      );
      await validatePostalAddresses(details, draft.details, client, true);
      const { rows: saved } = await client.query(
        "UPDATE tpa.application_drafts SET details=$2, version=version+1, updated_at=now() WHERE id=$1 RETURNING details, version",
        [draft.id, details],
      );
      await audit(
        client,
        actor.id,
        "application.staff_details_updated",
        draft.id,
      );
      return saved[0];
    });
  });
}
