import { randomUUID, randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import {
  operation,
  authorized,
  jsonBody,
  transaction,
  OperationError,
  audit,
} from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { boundedBody } from "@/domain/request-body";
import { policy } from "@/lib/verification-service";
import {
  importCells,
  mapImport,
  type ImportRow,
} from "@/domain/onboarding-import";
import { validateAnswers } from "@/domain/verification";
import { hashToken, queueOnboardingMail } from "@/lib/onboarding-mail";
export async function GET(r: Request) {
  try {
    const actor = await authorized(r, "staff:manage");
    const url = new URL(r.url);
    if (url.searchParams.has("template")) {
      const fields = [
        "name",
        "email",
        "category",
        "plan",
        "phone",
        "qualification",
        "organization",
      ];
      if (url.searchParams.get("template") === "xlsx") {
        const w = new ExcelJS.Workbook();
        w.addWorksheet("Accounts").addRow(fields);
        return new Response((await w.xlsx.writeBuffer()) as BodyInit, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": "attachment; filename=tpa-accounts.xlsx",
            "Cache-Control": "private, no-store",
          },
        });
      }
      return new Response(fields.join(",") + "\n", {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=tpa-accounts.csv",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (url.searchParams.has("id"))
      return operation(async () => {
        const db = getDatabase();
        const batch = (
          await db.query(
            "SELECT * FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2",
            [url.searchParams.get("id"), actor.id],
          )
        ).rows[0];
        if (!batch) throw new OperationError("Batch not found.", 404);
        const mail = (
          await db.query(
            "SELECT DISTINCT ON(recipient) recipient,id,status,reason FROM tpa.onboarding_mail WHERE kind='invitation' AND recipient=ANY($1::text[]) ORDER BY recipient,created_at DESC",
            [
              (batch.results ?? [])
                .filter((x: { status: string }) => x.status === "created")
                .map((x: { email: string }) => x.email),
            ],
          )
        ).rows;
        return {
          ...batch,
          results: (batch.results ?? []).map(
            (result: { email: string; status: string }) => ({
              ...result,
              emailStatus: mail.find((m) => m.recipient === result.email)
                ?.status,
              invitationId: mail.find((m) => m.recipient === result.email)?.id,
            }),
          ),
        };
      });
    return operation(async () => ({
      batches: (
        await getDatabase().query(
          "SELECT id,created_at,committed_at,results FROM tpa.onboarding_batches WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 20",
          [actor.id],
        )
      ).rows,
    }));
  } catch (e) {
    return operation(async () => {
      throw e;
    });
  }
}
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "staff:manage", true);
    if (process.env.ONBOARDING_ENABLED !== "true")
      throw new OperationError("Onboarding is disabled.", 503);
    const db = getDatabase();
    if (r.headers.get("content-type")?.includes("multipart/form-data")) {
      const bytes = await boundedBody(r, 5 * 1024 * 1024 + 65536),
        form = await new Response(bytes as BodyInit, {
          headers: { "Content-Type": r.headers.get("content-type")! },
        }).formData(),
        file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw new OperationError("Choose a file up to 5 MB.");
      const cells = await importCells(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
      );
      const p = await policy();
      if (!form.get("mapping"))
        return {
          headers: cells[0],
          sample: cells.slice(1, 6),
          fields: [
            "name",
            "email",
            "category",
            "plan",
            ...p.fields.filter((f) => f.type !== "document").map((f) => f.id),
          ],
        };
      const mapping = JSON.parse(String(form.get("mapping"))),
        rows = mapImport(
          cells,
          mapping,
          p.fields.filter((f) => f.type !== "document").map((f) => f.id),
        );
      for (const row of rows) {
        if (!row.error) {
          try {
            row.details = validateAnswers(row.details, p.fields);
          } catch {
            row.error = "Mapped values do not match field rules.";
          }
          if (
            (
              await db.query(
                'SELECT 1 FROM public."user" WHERE lower(email)=$1',
                [row.email],
              )
            ).rowCount
          )
            row.error = "Existing account — will be skipped.";
        }
      }
      const id = randomUUID();
      await db.query(
        "INSERT INTO tpa.onboarding_batches(id,actor_id,rows) VALUES($1,$2,$3)",
        [id, actor.id, JSON.stringify(rows)],
      );
      return { id, rows };
    }
    const i = await jsonBody(r);
    if (i.action === "retry" || i.action === "reissue") {
      return transaction(async (c) => {
        const job = (
          await c.query(
            "SELECT * FROM tpa.onboarding_mail WHERE id::text=$1 AND kind='invitation' FOR UPDATE",
            [i.id],
          )
        ).rows[0];
        if (!job) throw new OperationError("Invitation not found.");
        if (i.action === "retry") {
          if (job.reason === "uncertain_send_expired")
            throw new OperationError(
              "Reconcile the previous delivery before retrying.",
              409,
            );
          if (!["failed", "queued"].includes(job.status))
            throw new OperationError(
              "Only failed or queued invitations can be retried.",
            );
          await c.query(
            "UPDATE tpa.onboarding_mail SET status='queued',attempts=0,available_at=now() WHERE id=$1",
            [job.id],
          );
        } else {
          if (
            (
              await c.query(
                'SELECT 1 FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
                [job.user_id],
              )
            ).rowCount
          )
            throw new OperationError(
              "The account already has a password. Use recovery.",
            );
          await c.query(
            "DELETE FROM tpa.onboarding_invitations WHERE user_id=$1 AND redeemed_at IS NULL",
            [job.user_id],
          );
          const token = randomBytes(32).toString("base64url");
          await c.query(
            "INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours')",
            [hashToken(token), job.user_id],
          );
          await queueOnboardingMail(
            c,
            job.user_id,
            job.recipient,
            "invitation",
            `${process.env.BETTER_AUTH_URL}/invitation#token=${token}`,
            "reissue-" + randomUUID(),
          );
        }
        await audit(c, actor.id, "onboarding.invitation_" + i.action, job.id);
        return { saved: true };
      });
    }
    if (i.action !== "commit") throw new OperationError("Choose commit.");
    return transaction(async (c) => {
      const b = (
        await c.query(
          "SELECT * FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 FOR UPDATE",
          [i.id, actor.id],
        )
      ).rows[0];
      if (!b) throw new OperationError("Preview not found.", 404);
      if (b.committed_at) return { results: b.results, duplicate: true };
      const results = [];
      const p = await policy(c);
      for (const row of b.rows as ImportRow[]) {
        if (row.error) {
          results.push({
            email: row.email,
            status: "skipped",
            reason: row.error,
          });
          continue;
        }
        await c.query("SAVEPOINT onboarding_row");
        try {
          row.details = validateAnswers(row.details, p.fields);
          const user = randomUUID();
          const inserted = (
            await c.query(
              'INSERT INTO public."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,now(),now()) ON CONFLICT(email) DO NOTHING RETURNING id',
              [user, row.name, row.email],
            )
          ).rows[0];
          if (!inserted) {
            results.push({
              email: row.email,
              status: "skipped",
              reason: "Existing account",
            });
            continue;
          }
          await c.query(
            "INSERT INTO tpa.application_drafts(id,user_id,plan,category,details,requirement_version) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              user,
              row.plan ?? "Annual",
              row.category ?? "Professional",
              row.details,
              p.version,
            ],
          );
          const token = randomBytes(32).toString("base64url");
          await c.query(
            "INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours')",
            [hashToken(token), user],
          );
          await queueOnboardingMail(
            c,
            user,
            row.email,
            "invitation",
            `${process.env.BETTER_AUTH_URL}/invitation#token=${token}`,
            "invite-" + user,
          );
          results.push({ email: row.email, status: "created" });
        } catch {
          await c.query("ROLLBACK TO SAVEPOINT onboarding_row");
          results.push({
            email: row.email,
            status: "failed",
            reason:
              "Unable to create this row. Review its values and retry in a new batch.",
          });
        } finally {
          await c.query("RELEASE SAVEPOINT onboarding_row");
        }
      }
      await c.query(
        "UPDATE tpa.onboarding_batches SET committed_at=now(),results=$2 WHERE id=$1",
        [b.id, JSON.stringify(results)],
      );
      await audit(c, actor.id, "onboarding.import_committed", b.id);
      return { results };
    });
  });
}
