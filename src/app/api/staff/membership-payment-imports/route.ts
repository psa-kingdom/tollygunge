import { membershipPlans } from "@/lib/membership-plans";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { authorized, operation, transaction, jsonBody, OperationError, audit } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { boundedBody } from "@/domain/request-body";
import { importCells } from "@/domain/onboarding-import";
import { membershipPaymentHeaders, membershipPaymentRows, type MembershipPaymentRow } from "@/lib/membership-payment-import";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has("template")) {
    const auth = await operation(async () => { await authorized(request, "payments:manage"); return true; });
    if (!auth.ok) return auth;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Membership payments");
    sheet.addRow(membershipPaymentHeaders);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17364E" } };
    sheet.getRow(1).height = 26;
    [28, 36, 22, 24, 20].forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
    sheet.getColumn(3).numFmt = "@";
    sheet.getColumn(5).numFmt = "0.00";
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const plans = await membershipPlans();
    const labels = plans.map(plan=>plan.name);
    if (labels.join(",").length<250 && labels.every(name=>!/[",]/.test(name))) {
      for (let row = 2; row <= 1001; row++)
        sheet.getCell(row,4).dataValidation = { type:"list",allowBlank:true,formulae:['"'+labels.join(",")+'"'],showErrorMessage:true,error:"Choose a configured membership plan." };
    }
    const bytes = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="membership-payments-template.xlsx"',
      "Cache-Control": "private, no-store",
    } });
  }
  return operation(async () => {
    await authorized(request, "payments:manage");
    const rows = (await getDatabase().query(
      `SELECT i.id,i.name,i.email,i.mobile,coalesce(c.name,i.membership_plan) AS membership_plan,i.amount_paise,NULL::text AS paid_on,i.created_at,'Imported' AS source
       FROM tpa.imported_membership_payments i LEFT JOIN tpa.membership_plans c ON c.code=i.membership_plan
       UNION ALL
       SELECT m.id,coalesce(p.accepted->>'name','Member'),m.recipient,coalesce(p.mobile_normalized,''),
         m.membership_type,m.amount_paise,m.paid_on::text,m.confirmed_at,'Recorded'
       FROM tpa.membership_payments m JOIN tpa.memberships s ON s.id=m.membership_id
       JOIN tpa.people p ON p.id=s.person_id
       ORDER BY created_at DESC,id`,
    )).rows;
    return { rows };
  });
}

export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "payments:manage", true);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const bytes = await boundedBody(request, 5 * 1024 * 1024 + 65536);
      const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw new OperationError("Choose a CSV or Excel (.xlsx) file up to 5 MB.");
      let rows: MembershipPaymentRow[];
      try {
        const cells = await importCells(new Uint8Array(await file.arrayBuffer()), file.name);
        rows = membershipPaymentRows(cells, cells.sourceRows, await membershipPlans(true));
      } catch (error) { throw new OperationError((error as Error).message); }
      return transaction(async client => {
        const id = randomUUID();
        const fingerprints = rows.filter(row => !row.error).map(row => row.fingerprint);
        const existing = new Set((await client.query("SELECT fingerprint FROM tpa.imported_membership_payments WHERE fingerprint=ANY($1::text[])", [fingerprints])).rows.map(row => row.fingerprint));
        const seen = new Set<string>();
        const preview = rows.map(row => {
          const duplicate = !row.error && (existing.has(row.fingerprint) || seen.has(row.fingerprint));
          seen.add(row.fingerprint);
          return { ...row, duplicate };
        });
        await client.query("INSERT INTO tpa.membership_payment_imports(id,actor_id,filename,rows) VALUES($1,$2,$3,$4)", [id, actor.id, file.name.slice(0, 250), JSON.stringify(preview)]);
        return { id, rows: preview };
      });
    }
    const input = await jsonBody(request, 1024);
    if (input.action !== "confirm" || typeof input.id !== "string")
      throw new OperationError("Choose an import to confirm.");
    return transaction(async client => {
      const { rows: [batch] } = await client.query("SELECT * FROM tpa.membership_payment_imports WHERE id::text=$1 AND actor_id=$2 FOR UPDATE", [input.id, actor.id]);
      if (!batch) throw new OperationError("Import preview not found.", 404);
      if (batch.status === "imported") return { imported: 0, alreadyImported: true };
      const rows = batch.rows as MembershipPaymentRow[];
      if (rows.some(row => row.error)) throw new OperationError("Correct the invalid rows and upload the file again.");
      let imported = 0;
      for (const row of rows) {
        const result = await client.query(
          "INSERT INTO tpa.imported_membership_payments(id,import_id,name,email,mobile,membership_plan,amount_paise,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(fingerprint) DO NOTHING",
          [randomUUID(), batch.id, row.name, row.email, row.mobile, row.plan, row.amountPaise, row.fingerprint],
        );
        imported += result.rowCount ?? 0;
      }
      await client.query("UPDATE tpa.membership_payment_imports SET status='imported',imported_at=now() WHERE id=$1", [batch.id]);
      await audit(client, actor.id, "membership.payments_imported", batch.id);
      return { imported, skipped: rows.length - imported };
    });
  });
}
