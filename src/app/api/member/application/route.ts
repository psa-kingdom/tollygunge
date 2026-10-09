import { applicationInput } from "@/domain/operations";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import {
  operation,
  authorized,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { policy } from "@/lib/verification-service";
import { validateAnswers } from "@/domain/verification";
export const runtime = "nodejs";
export async function GET(r: Request) {
  return operation(async () => {
    const a = await authorized(r),
      db = getDatabase();
    const row = (
      await db.query("SELECT * FROM tpa.application_drafts WHERE user_id=$1", [
        a.id,
      ])
    ).rows[0];
    if (!row) return null;
    return {
      ...row,
      documentIds: (
        await db.query(
          "SELECT document_id FROM tpa.application_documents WHERE application_id=$1",
          [row.id],
        )
      ).rows.map((x) => x.document_id),
      status: "draft",
      checkoutAvailable: false,
    };
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    const a = await authorized(r, undefined, true),
      i = await jsonBody(r, 128000);
    if (
      !Number.isInteger(i.version) ||
      i.version < 0 ||
      !["Annual", "Life", "Patron"].includes(i.plan) ||
      !["Professional", "Student"].includes(i.category) ||
      !Array.isArray(i.documentIds) ||
      i.documentIds.length > 100 ||
      (i.step !== undefined &&
        (!Number.isInteger(i.step) || i.step < 0 || i.step > 4))
    )
      throw new OperationError("Check your draft.");
    return transaction(async (c) => {
      await c.query('SELECT id FROM public."user" WHERE id=$1 FOR UPDATE', [
        a.id,
      ]);
      const existing = (
        await c.query(
          "SELECT * FROM tpa.application_drafts WHERE user_id=$1 FOR UPDATE",
          [a.id],
        )
      ).rows[0];
      if ((existing?.version ?? 0) !== i.version)
        throw new OperationError(
          "Your draft changed in another tab. Reload before saving.",
          409,
        );
      const p = await policy(c);
      const legacy = process.env.ONBOARDING_ENABLED !== "true";
      const details = legacy
        ? applicationInput(i).details
        : validateAnswers(i.details, p.fields);
      for (const [id, value] of Object.entries(details)) {
        if (
          !legacy &&
          !p.fields.some((f) => f.id === id) &&
          value !== existing?.details?.[id]
        )
          throw new OperationError("Use fields from the published form.");
      }
      const ids = new Set<string>(i.documentIds);
      for (const f of p.fields.filter(
        (x) => x.type === "document" && details[x.id],
      ))
        ids.add(details[f.id]);
      for (const id of ids)
        if (
          !(
            await c.query(
              "SELECT 1 FROM tpa.private_documents WHERE id::text=$1 AND owner_user_id=$2",
              [id, a.id],
            )
          ).rowCount
        )
          throw new OperationError("Select only your own documents.", 403);
      const row = (
        await c.query(
          "INSERT INTO tpa.application_drafts(id,user_id,plan,category,details,step,requirement_version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET plan=$3,category=$4,details=$5,step=$6,requirement_version=$7,version=tpa.application_drafts.version+1,updated_at=now() RETURNING *",
          [
            existing?.id ?? randomUUID(),
            a.id,
            i.plan,
            i.category,
            details,
            i.step ?? 0,
            p.version,
          ],
        )
      ).rows[0];
      await c.query(
        "DELETE FROM tpa.application_documents WHERE application_id=$1",
        [row.id],
      );
      for (const id of ids)
        await c.query(
          "INSERT INTO tpa.application_documents(application_id,document_id) VALUES($1,$2)",
          [row.id, id],
        );
      await audit(c, a.id, "application.draft_saved", row.id);
      return {
        ...row,
        documentIds: [...ids],
        status: "draft",
        checkoutAvailable: false,
      };
    });
  });
}
