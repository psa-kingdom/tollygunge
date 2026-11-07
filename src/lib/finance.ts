import "server-only";
import type { PoolClient } from "pg";
import { getDatabase } from "./database";
import { audit, OperationError } from "./operation-api";
import { editableEvent, lockOperationalEvent } from "./event-operations";
import { hasPermission } from "@/domain/access";
import {
  expenseLines,
  financeAmount,
  financeDate,
  financeTotals,
  type FinanceLine,
} from "@/domain/finance";
import { text, uuid, version } from "@/domain/operations";
import { queueEventMail } from "./event-mail";
export type FinanceActor = { id: string; roles: readonly string[] };
export async function financeHistory(
  c: PoolClient,
  id: string,
  actor: string,
  action: string,
  details: unknown = {},
) {
  await c.query(
    "INSERT INTO tpa.finance_history(entry_id,actor_id,action,details) VALUES($1,$2,$3,$4)",
    [id, actor, action, JSON.stringify(details)],
  );
  await audit(c, actor, "finance." + action, id);
}
export function financeWriter(actor: FinanceActor) {
  if (
    !hasPermission(actor.roles, "payments:manage") ||
    hasPermission(actor.roles, "finance:approve")
  )
    throw new OperationError(
      "Admins enter finances; the super admin reviews them.",
      403,
    );
}
export async function financeRead(params: URLSearchParams) {
  const eventId = params.get("eventId") ? uuid(params.get("eventId")) : null;
  const from = params.get("from") ? financeDate(params.get("from")) : null,
    to = params.get("to") ? financeDate(params.get("to")) : null;
  if (from && to && from > to)
    throw new OperationError("Start date must be before end date.");
  const db = getDatabase();
  const entries = (
    await db.query(
      `SELECT f.*,f.entry_date::text AS entry_date,e.title AS event_title,coalesce(u.name,'Legacy import') AS creator_name,rv.name AS reviewer_name,p.id AS proof_id,p.content_type AS proof_type,
 coalesce((SELECT name FROM public."user" WHERE id=r.user_id), f.manual_participant_name) AS participant_name,
 coalesce((SELECT jsonb_agg(jsonb_build_object('action',h.action,'created_at',h.created_at,'actor',hu.name,'details',h.details) ORDER BY h.id) FROM tpa.finance_history h JOIN public."user" hu ON hu.id=h.actor_id WHERE h.entry_id=f.id),'[]') AS history
 FROM tpa.finance_entries f JOIN tpa.events e ON e.id=f.event_id LEFT JOIN public."user" u ON u.id=f.created_by
 LEFT JOIN public."user" rv ON rv.id=f.reviewed_by LEFT JOIN tpa.finance_proofs p ON p.entry_id=f.id
 LEFT JOIN tpa.event_registrations r ON r.id=f.registration_id
 WHERE ($1::uuid IS NULL OR f.event_id=$1) ORDER BY f.created_at DESC,f.id`,
      [eventId],
    )
  ).rows;
  // Expense filtering uses the actual line date, not the sheet submission date.
  const rows = entries.flatMap((f) => {
    if (f.kind === "expenses") {
      const lines = f.lines.filter(
        (l: { date: string }) =>
          (!from || l.date >= from) && (!to || l.date <= to),
      );
      return lines.length || (!from && !to)
        ? [
            {
              ...f,
              allLines: f.lines,
              lines,
              amount_paise: lines.reduce(
                (n: number, l: { amountPaise: number }) =>
                  n + Number(l.amountPaise),
                0,
              ),
            },
          ]
        : [];
    }
    const date =
      f.entry_date instanceof Date
        ? f.entry_date.toISOString().slice(0, 10)
        : String(f.entry_date).slice(0, 10);
    return (!from || date >= from) && (!to || date <= to)
      ? [{ ...f, entry_date: date, amount_paise: Number(f.amount_paise) }]
      : [];
  });
  return {
    entries: rows,
    totals: financeTotals(rows),
    filters: { eventId, from, to },
    events: (
      await db.query(
        `SELECT e.id,e.title,e.starts_at,e.ends_at,e.location,e.status,e.completed_at,e.archived_at,
 (SELECT count(*)::int FROM tpa.event_registrations r WHERE r.event_id=e.id AND r.status='registered') AS participant_count
 FROM tpa.events e ORDER BY e.starts_at DESC,e.id`,
      )
    ).rows,
    registrations: eventId
      ? (
          await db.query(
            `SELECT r.id,r.fee_paise,r.payment_status,r.status,u.name FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id WHERE r.event_id=$1 ORDER BY u.name,r.id`,
            [eventId],
          )
        ).rows
      : [],
  };
}
export async function memberRegistration(
  c: PoolClient,
  eventId: string,
  registrationId: string,
  owner?: string,
) {
  const r = (
    await c.query(
      "SELECT * FROM tpa.event_registrations WHERE id=$1 AND event_id=$2 FOR UPDATE",
      [registrationId, eventId],
    )
  ).rows[0];
  if (!r || (owner && r.user_id !== owner))
    throw new OperationError("Registration not found.", 404);
  if (
    r.status !== "registered" ||
    !r.fee_paise ||
    !["pending", "failed"].includes(r.payment_status)
  )
    throw new OperationError(
      "This registration does not await a fee receipt.",
      409,
    );
  return r;
}
export async function createReceipt(
  c: PoolClient,
  actor: FinanceActor,
  i: Record<string, unknown>,
  member = false,
) {
  if (!member) financeWriter(actor);
  const eventId = uuid(i.eventId),
    event = await lockOperationalEvent(c, eventId);
  editableEvent(event);
  if (event.status === "cancelled" || (member && event.status !== "published"))
    throw new OperationError("Event is not accepting receipts.", 409);
  const registrationId = i.registrationId ? uuid(i.registrationId) : null;
  if (member && !registrationId)
    throw new OperationError("Choose your event registration.");
  const registration = registrationId
    ? await memberRegistration(
        c,
        eventId,
        registrationId,
        member ? actor.id : undefined,
      )
    : null;
  const amount = financeAmount(i.amountPaise);
  if (registration && amount !== registration.fee_paise)
    throw new OperationError("Submit the full registration fee.");
  const manualParticipant =
    !member && !registration && i.participantName !== undefined
      ? text(i.participantName, "Participant name", 160, 1)
      : null;
  const id = uuid(i.id),
    label =
      registration || manualParticipant
        ? "Participant fee"
        : text(i.label, "Source of funds", 160, 3);
  const date = financeDate(i.date),
    method = text(i.method, "Method", 80, 1),
    reference = text(i.reference, "Reference", 200, 3),
    note = text(i.note ?? "", "Note", 1000, member ? 0 : 3);
  if (!member) await requireSuperAdmin(c);
  await c.query(
    `INSERT INTO tpa.finance_entries(id,event_id,kind,source,registration_id,label,amount_paise,entry_date,method,reference,note,status,created_by,manual_participant_name)
 VALUES($1,$2,'receipt',$3,$4,$5,$6,$7,$8,$9,$10,'submitted',$11,$12)`,
    [
      id,
      eventId,
      member ? "member" : "admin",
      registrationId,
      label,
      amount,
      date,
      method,
      reference,
      note,
      actor.id,
      manualParticipant,
    ],
  );
  await financeHistory(c, id, actor.id, "submitted", {
    amount,
    date,
    method,
    reference,
    note,
    registrationId,
    manualParticipant,
    label,
  });
  return { id };
}
async function requireSuperAdmin(c: PoolClient) {
  if (
    !(
      await c.query(
        "SELECT 1 FROM tpa.staff_roles WHERE role='super_administrator'",
      )
    ).rowCount
  )
    throw new OperationError(
      "Set up the super admin before submitting finances.",
      409,
    );
}
async function registrationTransition(
  c: PoolClient,
  actor: FinanceActor,
  f: Record<string, unknown>,
  event: { title: string; id: string },
) {
  if (!f.registration_id) return;
  const r = (
    await c.query(
      "SELECT * FROM tpa.event_registrations WHERE id=$1 AND event_id=$2 FOR UPDATE",
      [f.registration_id, event.id],
    )
  ).rows[0];
  const next = f.kind === "refund" ? "refunded" : "paid";
  if (
    !r ||
    (next === "paid" &&
      (r.status !== "registered" ||
        !["pending", "failed"].includes(r.payment_status) ||
        event.title === undefined)) ||
    (next === "refunded" && r.payment_status !== "paid")
  )
    throw new OperationError(
      "Registration changed. Reload before approval.",
      409,
    );
  if (Number(f.amount_paise) !== r.fee_paise)
    throw new OperationError(
      "Fee changed. Return this entry for correction.",
      409,
    );
  await c.query(
    `INSERT INTO tpa.event_payment_history(registration_id,from_status,to_status,fee_paise,reference,note,actor_id,previous_reference,previous_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      r.id,
      r.payment_status,
      next,
      r.fee_paise,
      f.reference,
      f.note,
      actor.id,
      r.payment_reference,
      r.payment_note,
    ],
  );
  await c.query(
    `UPDATE tpa.event_registrations SET payment_status=$2,status=CASE WHEN $2='refunded' THEN 'cancelled' ELSE status END,payment_reference=$3,payment_note=$4,payment_updated_by=$5,payment_updated_at=now(),version=version+1 WHERE id=$1`,
    [r.id, next, f.reference, f.note, actor.id],
  );
  await queueEventMail(
    c,
    r.user_id,
    event.title,
    next,
    `${r.id}-${r.version + 1}`,
  );
  await c.query(
    "UPDATE tpa.events SET attendance_finalized_at=NULL WHERE id=$1",
    [event.id],
  );
}
export async function financeMutation(
  c: PoolClient,
  actor: FinanceActor,
  i: Record<string, unknown>,
) {
  const action = String(i.action);
  if (action === "receipt.create") return createReceipt(c, actor, i);
  const eventId = uuid(i.eventId),
    e = await lockOperationalEvent(c, eventId);
  editableEvent(e);
  if (e.status === "cancelled")
    throw new OperationError(
      "Reopen or correct the event before changing finances.",
      409,
    );
  if (["approve", "return"].includes(action)) {
    const f = (
      await c.query(
        "SELECT * FROM tpa.finance_entries WHERE id=$1 AND event_id=$2 FOR UPDATE",
        [uuid(i.id), eventId],
      )
    ).rows[0];
    if (!f || f.version !== version(i.version) || f.status !== "submitted")
      throw new OperationError(
        "Submission changed. Reload before reviewing.",
        409,
      );
    const member = f.source === "member";
    if (
      member
        ? !hasPermission(actor.roles, "payments:manage") ||
          hasPermission(actor.roles, "finance:approve")
        : !hasPermission(actor.roles, "finance:approve")
    )
      throw new OperationError(
        "This submission requires its designated reviewer.",
        403,
      );
    if (f.created_by === actor.id)
      throw new OperationError("You cannot review your own submission.", 403);
    const reason = text(i.reason, "Review reason", 1000, 3);
    if (action === "approve") {
      if (f.replaces_id) {
        const prior = (
          await c.query(
            "SELECT * FROM tpa.finance_entries WHERE id=$1 AND event_id=$2 AND status='approved' FOR UPDATE",
            [f.replaces_id, eventId],
          )
        ).rows[0];
        if (!prior || prior.kind !== f.kind)
          throw new OperationError(
            "Approved record changed. Return and reload.",
            409,
          );
        await c.query(
          "UPDATE tpa.finance_entries SET status='superseded',version=version+1 WHERE id=$1",
          [prior.id],
        );
      }
      if (f.kind !== "expenses" && f.registration_id && !f.replaces_id)
        await registrationTransition(c, actor, f, e);
    }
    await c.query(
      "UPDATE tpa.finance_entries SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),version=version+1 WHERE id=$1",
      [f.id, action === "approve" ? "approved" : "returned", actor.id, reason],
    );
    await financeHistory(c, f.id, actor.id, action, { reason });
    await c.query(
      "UPDATE tpa.events SET financial_reviewed_at=NULL WHERE id=$1",
      [eventId],
    );
    return { saved: true };
  }
  financeWriter(actor);
  if (action === "refund.create") {
    await requireSuperAdmin(c);
    const registrationId = uuid(i.registrationId),
      r = (
        await c.query(
          "SELECT * FROM tpa.event_registrations WHERE id=$1 AND event_id=$2 AND payment_status='paid' FOR UPDATE",
          [registrationId, eventId],
        )
      ).rows[0];
    if (!r) throw new OperationError("Choose a paid registration.", 409);
    if (
      (
        await c.query(
          "SELECT 1 FROM tpa.finance_entries WHERE registration_id=$1 AND kind='refund' AND status='submitted'",
          [registrationId],
        )
      ).rowCount
    )
      throw new OperationError("Refund already submitted.", 409);
    const id = uuid(i.id);
    await c.query(
      "INSERT INTO tpa.finance_entries(id,event_id,kind,source,registration_id,label,amount_paise,entry_date,method,reference,note,status,created_by) VALUES($1,$2,'refund','admin',$3,'Participant refund',$4,$5,$6,$7,$8,'submitted',$9)",
      [
        id,
        eventId,
        registrationId,
        r.fee_paise,
        financeDate(i.date),
        text(i.method, "Method", 80, 1),
        text(i.reference, "Refund reference", 200, 3),
        text(i.note, "Refund reason", 1000, 3),
        actor.id,
      ],
    );
    await financeHistory(c, id, actor.id, "submitted");
    return { id };
  }
  if (
    ![
      "sheet.save",
      "sheet.add",
      "entry.resubmit",
      "receipt.correct",
      "refund.correct",
    ].includes(action)
  )
    throw new OperationError("Unknown finance action.");
  const existing = i.existingId
    ? (
        await c.query(
          "SELECT * FROM tpa.finance_entries WHERE id=$1 AND event_id=$2 FOR UPDATE",
          [uuid(i.existingId), eventId],
        )
      ).rows[0]
    : null;
  if (
    i.existingId &&
    (!existing ||
      existing.version !== version(i.version) ||
      !["draft", "returned"].includes(existing.status) ||
      existing.source === "member")
  )
    throw new OperationError("Entry changed or is locked.", 409);
  if (
    action === "entry.resubmit" &&
    (!existing || existing.kind === "expenses")
  )
    throw new OperationError("Choose a returned receipt or refund.", 409);
  if (existing && ["receipt.correct", "refund.correct"].includes(action))
    throw new OperationError("Revise the returned entry instead.", 409);
  if (existing && existing.created_by !== actor.id)
    throw new OperationError(
      "Only the author can revise this submission.",
      403,
    );
  let lines: FinanceLine[] = [],
    amount = 0,
    label = "",
    kind = "expenses",
    registrationId = null,
    method = "",
    reference = "",
    note = text(i.note ?? "", "Note", 1000);
  const date = financeDate(i.date);
  let replacesId = existing?.replaces_id ?? null;
  let manualParticipant: string | null =
    existing?.manual_participant_name ?? null;
  if (action === "sheet.save" || action === "sheet.add") {
    lines = i.void === true ? [] : expenseLines(i.lines);
    if (
      i.void === true &&
      (!i.replacesId || !text(i.note, "Void reason", 1000, 3))
    )
      throw new OperationError(
        "An approved sheet and void reason are required.",
      );
    amount = lines.reduce((n, l) => n + l.amountPaise, 0);
    label = "Event expense sheet";
    if (existing && existing.kind !== "expenses")
      throw new OperationError("Choose an expense sheet.");
    if (action === "sheet.add" && (existing || i.replacesId || i.void === true))
      throw new OperationError(
        "A new expense submission cannot replace an existing sheet.",
      );
    if (action === "sheet.save") {
      const target = i.replacesId ? uuid(i.replacesId) : existing?.replaces_id;
      // Unlinked existing drafts are additions. Legacy create requests still revise a single approved sheet.
      const approved =
        target || !existing
          ? (
              await c.query(
                "SELECT id FROM tpa.finance_entries WHERE event_id=$1 AND kind='expenses' AND status='approved' AND ($2::uuid IS NULL OR id=$2) ORDER BY reviewed_at DESC NULLS LAST, id LIMIT 2",
                [eventId, target ?? null],
              )
            ).rows
          : [];
      if (
        (target && approved.length !== 1) ||
        (!target && approved.length > 1) ||
        (existing && (existing.replaces_id ?? null) !== (target ?? null))
      )
        throw new OperationError(
          "Choose the approved sheet to revise, or add a new expense.",
          409,
        );
      if (i.void === true && !approved.length)
        throw new OperationError("No approved sheet to void.", 409);
      if (approved.length) text(i.note, "Correction reason", 1000, 3);
      replacesId = approved[0]?.id ?? null;
    }
  } else {
    kind = existing?.kind ?? "receipt";
    registrationId = existing?.registration_id ?? null;
    if (action === "receipt.correct" || action === "refund.correct") {
      const prior = (
        await c.query(
          "SELECT * FROM tpa.finance_entries WHERE id=$1 AND event_id=$2 AND kind=$3 AND status='approved' FOR UPDATE",
          [
            uuid(i.replacesId),
            eventId,
            action === "refund.correct" ? "refund" : "receipt",
          ],
        )
      ).rows[0];
      if (!prior) throw new OperationError("Approved record not found.", 409);
      replacesId = prior.id;
      kind = prior.kind;
      registrationId = prior.registration_id;
      manualParticipant = prior.manual_participant_name;
      if (
        registrationId &&
        Number(i.amountPaise) !== Number(prior.amount_paise)
      )
        throw new OperationError(
          "Participant corrections retain the full fee. Use a refund to reverse collection.",
          409,
        );
    }
    amount =
      i.void === true && replacesId && !registrationId
        ? 0
        : financeAmount(i.amountPaise);
    if (manualParticipant && i.participantName !== undefined)
      manualParticipant = text(i.participantName, "Participant name", 160, 1);
    label = text(i.label, "Source", 160, 3);
    method = text(i.method, "Method", 80, 1);
    reference = text(i.reference, "Reference", 200, 3);
    note = text(i.note, "Note", 1000, 3);
    if (registrationId && !replacesId) {
      const r =
        kind === "receipt"
          ? await memberRegistration(c, eventId, registrationId)
          : null;
      if (r && r.fee_paise !== amount)
        throw new OperationError("Submit the full fee.");
    }
  }
  const id = existing?.id ?? uuid(i.id),
    status = i.submit === true || kind !== "expenses" ? "submitted" : "draft";
  if (status === "submitted") await requireSuperAdmin(c);
  if (existing)
    await c.query(
      `UPDATE tpa.finance_entries SET lines=$2,amount_paise=$3,entry_date=$4,label=$5,method=$6,reference=$7,note=$8,status=$9,manual_participant_name=$10,version=version+1 WHERE id=$1`,
      [
        id,
        JSON.stringify(lines),
        amount,
        date,
        label,
        method,
        reference,
        note,
        status,
        manualParticipant,
      ],
    );
  else
    await c.query(
      `INSERT INTO tpa.finance_entries(id,event_id,kind,source,registration_id,label,amount_paise,entry_date,method,reference,note,lines,status,replaces_id,created_by,manual_participant_name) VALUES($1,$2,$3,'admin',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        eventId,
        kind,
        registrationId,
        label,
        amount,
        date,
        method,
        reference,
        note,
        JSON.stringify(lines),
        status,
        replacesId,
        actor.id,
        manualParticipant,
      ],
    );
  await financeHistory(c, id, actor.id, status, { lines, amount, date, note });
  return { id };
}
