import { randomUUID, createHash } from "node:crypto";
import { approvedAccountPolicy } from "@/domain/approved-account-batch";
import { memberHeaders } from "@/domain/member-import";
import {
  createMemberPreview,
  createApprovedAccountPreview,
  memberBatchAction,
  isMemberBatch,
} from "@/lib/member-import";
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
  templateImport,
  type ImportRow,
} from "@/domain/onboarding-import";
import { validateAnswers } from "@/domain/verification";
import { validatePostalAddresses } from "@/lib/postal-directory";

import { createInvitedAccount } from "@/lib/account-provisioning";
export async function GET(r: Request) {
  try {
    const actor = await authorized(r, "staff:manage");
    const url = new URL(r.url);
    if (url.searchParams.has("template")) {
      const fields = memberHeaders;
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
          invitationReviewId: batch.choices?.invitationReviewId,
          mode:
            batch.choices?.approval === approvedAccountPolicy.approval
              ? "approved-accounts"
              : batch.mode,
          results: (batch.results ?? []).map(
            (result: {
              email: string;
              status: string;
              invitationStatus?: string;
            }) => ({
              ...result,
              emailStatus:
                mail.find((m) => m.recipient === result.email)?.status ??
                (result.invitationStatus === "held" ? "held" : undefined),
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
    const db = getDatabase();
    if (r.headers.get("content-type")?.includes("multipart/form-data")) {
      const bytes = await boundedBody(r, 5 * 1024 * 1024 + 65536),
        form = await new Response(bytes as BodyInit, {
          headers: { "Content-Type": r.headers.get("content-type")! },
        }).formData(),
        file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw new OperationError("Choose a file up to 5 MB.");
      const parsed = await importCells(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        { rowErrors: true },
      );
      const cells = parsed;
      const p = await policy();
      const mode = String(form.get("mode") ?? "invitation");
      if (
        ![
          "invitation",
          "existing-members",
          "members",
          "accounts",
          "approved-accounts",
        ].includes(mode)
      )
        throw new OperationError("Choose an import mode.");
      if (
        mode === "existing-members" ||
        mode === "members" ||
        mode === "approved-accounts"
      ) {
        return transaction(async (c) => {
          const sourceHash = createHash("sha256")
            .update(new Uint8Array(await file.arrayBuffer()))
            .digest("hex");
          const preview =
            mode === "approved-accounts"
              ? await createApprovedAccountPreview(
                  c,
                  actor.id,
                  cells,
                  sourceHash,
                  cells.sourceRows,
                  cells.cellErrors,
                )
              : await createMemberPreview(
                  c,
                  actor.id,
                  cells,
                  cells.sourceRows,
                  cells.cellErrors,
                  mode === "existing-members",
                );
          await c.query(
            "UPDATE tpa.onboarding_batches SET source_hash=$2,filename=$3 WHERE id=$1",
            [
              preview.id,
              createHash("sha256")
                .update(new Uint8Array(await file.arrayBuffer()))
                .digest("hex"),
              file.name,
            ],
          );
          return {
            ...preview,
            mode,
            rows: preview.rows.map((row) => ({
              ...row,
              ...(row.status === "failed" || row.status === "conflict"
                ? { error: row.reason }
                : {}),
            })),
          };
        });
      }
      if (Object.keys(cells.cellErrors ?? {}).length)
        throw new OperationError(
          "Formula or malformed Excel cells are not accepted in account imports.",
        );
      if (process.env.ONBOARDING_ENABLED !== "true")
        throw new OperationError("Onboarding is disabled.", 503);
      const allowed = p.fields.filter((field) => field.type !== "document").map((field) => field.id);
      const rows = form.get("mapping")
        ? mapImport(cells, JSON.parse(String(form.get("mapping"))), allowed)
        : templateImport(cells, allowed);
      for (const row of rows) {
        if (!row.error) {
          try {
            if (row.category && row.category !== "Professional")
              throw new OperationError(
                "Only professional applications may be imported.",
              );
            row.details = validateAnswers(row.details, p.fields);
            await validatePostalAddresses(row.details, {}, db, true, "as-entered");
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
    if (await isMemberBatch(i.id, actor.id))
      return transaction((c) => memberBatchAction(c, actor.id, i));
    if (process.env.ONBOARDING_ENABLED !== "true")
      throw new OperationError("Onboarding is disabled.", 503);
    if (i.action === "reissue") throw new OperationError('Review the recipient and approved invitation template before issuing a replacement link.',409,'invitation_review_required');
    if (i.action === "retry") {
      return transaction(async (c) => {
        const job = (
          await c.query(
            "SELECT * FROM tpa.onboarding_mail WHERE id::text=$1 AND kind='invitation' FOR UPDATE",
            [i.id],
          )
        ).rows[0];
        if (!job) throw new OperationError("Invitation not found.");
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
      const results = [...(b.results ?? [])];
      const p = await policy(c);
      for (const row of (b.rows as ImportRow[]).slice(
        results.length,
        results.length + 25,
      )) {
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
          if (row.category && row.category !== "Professional")
            throw new OperationError(
              "Only professional applications may be imported.",
            );
          row.details = validateAnswers(row.details, p.fields);
          await validatePostalAddresses(row.details, {}, c, true, "as-entered");
          const inserted = await createInvitedAccount(c, {
            name: row.name,
            email: row.email,
            freeMembership: true,
          }, { batchId: b.id });
          if (!inserted) {
            results.push({
              email: row.email,
              status: "skipped",
              reason: "Existing account",
            });
            continue;
          }
          const user = inserted.accountId;
          const details = row.details;
          const profile = {
            ...(details.firstName && { firstName: details.firstName }),
            ...(details.lastName && { lastName: details.lastName }),
            ...(details.title && { prefix: details.title }),
            ...(details.organization && { organization: details.organization }),
            ...(details.designation && { jobTitle: details.designation }),
            ...(["address", "city", "district", "state", "pin", "country"].some(field => details[field]) && {
              addresses: { correspondence: {
                line1: details.address ?? "", line2: "", country: details.country ?? "",
                state: details.state ?? "", district: details.district ?? "", city: details.city ?? "",
                postalCode: details.pin ?? "", postalLocality: details.postalLocality ?? "",
              } },
            }),
          };
          await c.query(
            "UPDATE tpa.people SET accepted=accepted||$2::jsonb,draft=draft||$2::jsonb WHERE user_id=$1",
            [user, JSON.stringify(profile)],
          );
          if (details.membershipNumber) await c.query(
            "UPDATE tpa.memberships m SET membership_number=$2 FROM tpa.people p WHERE m.person_id=p.id AND p.user_id=$1",
            [user, details.membershipNumber],
          );

          await c.query(
            "UPDATE tpa.people SET mobile_normalized=$2,accepted=accepted||jsonb_build_object('mobile',$2::text),draft=draft||jsonb_build_object('mobile',$2::text) WHERE user_id=$1",
            [user, row.details.phone ?? ""],
          );
          await c.query(
            "INSERT INTO tpa.application_drafts(id,user_id,plan,category,details,requirement_version) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              user,
              "Free",
              row.category ?? "Professional",
              row.details,
              p.version,
            ],
          );
          results.push({ email: row.email, status: "created",accountId:inserted.accountId,invitationStatus:inserted.invitationStatus,invitationQueued:false });
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
      const complete = results.length === b.rows.length;
      await c.query(
        "UPDATE tpa.onboarding_batches SET committed_at=CASE WHEN $3 THEN now() ELSE NULL END,results=$2 WHERE id=$1",
        [b.id, JSON.stringify(results), complete],
      );
      if (complete)
        await audit(c, actor.id, "onboarding.import_committed", b.id);
      return {
        results,
        complete,
        processed: results.length,
        total: b.rows.length,
      };
    });
  });
}
