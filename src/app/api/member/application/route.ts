import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { applicationInput } from "@/domain/operations";
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
    const actor = await authorized(request);
    const row = (
      await getDatabase().query(
        "SELECT * FROM tpa.application_drafts WHERE user_id=$1",
        [actor.id],
      )
    ).rows[0];
    if (!row) return null;
    const documents = (
      await getDatabase().query(
        "SELECT document_id FROM tpa.application_documents WHERE application_id=$1",
        [row.id],
      )
    ).rows;
    return {
      ...row,
      documentIds: documents.map((d) => d.document_id),
      status: "draft",
      checkoutAvailable: false,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true),
      input = applicationInput(await jsonBody(request, 12000));
    return transaction(async (client) => {
      // Serialize first-save and subsequent revisions for one applicant.
      await client.query(
        'SELECT id FROM public."user" WHERE id=$1 FOR UPDATE',
        [actor.id],
      );
      const existing = (
        await client.query(
          "SELECT * FROM tpa.application_drafts WHERE user_id=$1",
          [actor.id],
        )
      ).rows[0];
      if ((existing?.version ?? 0) !== input.version)
        throw new OperationError(
          "Your draft changed. Reload before saving.",
          409,
        );
      for (const id of input.documentIds)
        if (
          !(
            await client.query(
              "SELECT 1 FROM tpa.private_documents WHERE id=$1 AND owner_user_id=$2",
              [id, actor.id],
            )
          ).rowCount
        )
          throw new OperationError("Select only your own documents.", 403);
      const id = existing?.id ?? randomUUID();
      const row = (
        await client.query(
          "INSERT INTO tpa.application_drafts(id,user_id,plan,category,details) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET plan=$3,category=$4,details=$5,version=tpa.application_drafts.version+1,updated_at=now() RETURNING *",
          [id, actor.id, input.plan, input.category, input.details],
        )
      ).rows[0];
      await client.query(
        "DELETE FROM tpa.application_documents WHERE application_id=$1",
        [id],
      );
      for (const doc of input.documentIds)
        await client.query(
          "INSERT INTO tpa.application_documents(application_id,document_id) VALUES($1,$2)",
          [id, doc],
        );
      await audit(client, actor.id, "application.draft_saved", id);
      return {
        ...row,
        documentIds: input.documentIds,
        status: "draft",
        checkoutAvailable: false,
      };
    });
  });
}
