import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { record, text } from "@/domain/operations";
import { mobile } from "@/domain/member-foundation";
import { rosterMatches } from "@/domain/event-roster";
import { registrationFields } from "@/domain/event-registration-fields";
import { audit, jsonBody, OperationError } from "./operation-api";
import { queueEventMail } from "./event-mail";
import { recordRegistrationPayment } from "./finance";
import { paymentProofForm } from "./finance-upload";
import { eventOrganiserUpis, syncOrganiserPayments } from "./organiser-upi";

export async function registrationRequest(request: Request) {
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data;");
  const { input, file } = multipart
    ? await paymentProofForm(request)
    : { input: record(await jsonBody(request, 8192)), file: null };
  if (input.paymentMode !== undefined && input.paymentMode !== "Yes" && input.paymentMode !== "No")
    throw new OperationError("Choose whether to pay now.");
  const payNow = input.paymentMode === "Yes";
  if (!payNow && file instanceof File && file.size > 0)
    throw new OperationError("Select Yes to submit payment proof.");
  return { input, file, payNow };
}

export function registrationDetails(value: unknown): Record<string, string> {
  const input = record(value);
  try {
    return Object.fromEntries(
      registrationFields.map((field) => [
        field.name,
        field.name === "mobile"
          ? mobile(text(input.mobile, field.label, 32, 1))
          : text(
              input[field.name] ?? "",
              field.label,
              160,
              "required" in field ? 1 : 0,
            ),
      ]),
    );
  } catch (error) {
    throw new OperationError((error as Error).message);
  }
}

export async function registerEvent(
  client: PoolClient,
  userId: string,
  eventId: string,
  details: Record<string, string> | null,
  publicOnly = false,
  attachPaymentProof?: (entryId: string, ownerId: string) => Promise<void>,
) {
  let event = (
    await client.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [
      eventId,
    ])
  ).rows[0];
  if (
    !event ||
    (publicOnly && event.visibility !== "public") ||
    event.status !== "published" ||
    event.completed_at ||
    event.archived_at ||
    new Date(event.starts_at).getTime() <= Date.now()
  )
    throw new OperationError("Registration is closed.", 409);
  if (event.booking_closed)
    throw new OperationError("Registration is closed.", 409);
  if (
    (event.registration_starts_at &&
      new Date(event.registration_starts_at).getTime() > Date.now()) ||
    (event.registration_ends_at &&
      new Date(event.registration_ends_at).getTime() <= Date.now())
  )
    throw new OperationError(
      "Registration is outside the booking window.",
      409,
    );
  if (
    event.visibility === "members" &&
    !(
      await client.query(
        "SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND m.type IS DISTINCT FROM 'Free' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)",
        [userId],
      )
    ).rowCount
  )
    throw new OperationError("This event requires active membership.", 403);
  const existing = (
    await client.query(
      "SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2",
      [eventId, userId],
    )
  ).rows[0];
  if (existing?.status === "registered")
    return { registration: existing, created: false };
  if (["paid", "refunded"].includes(existing?.payment_status))
    throw new OperationError(
      "A paid cancellation requires staff review before rebooking.",
      409,
    );
  event = await syncOrganiserPayments(client,event,userId);
  if (attachPaymentProof && (!event.fee_paise || !(await eventOrganiserUpis(event, client)).length))
    throw new OperationError("Online UPI payment is unavailable for this event. Choose No to register and pay later.", 409);
  const identity = (
    await client.query(
      `SELECT u.email,coalesce(m.membership_number,'') AS number,coalesce(p.mobile_normalized,'') AS phone,u.name FROM public."user" u LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.memberships m ON m.person_id=p.id WHERE u.id=$1`,
      [userId],
    )
  ).rows[0];
  const imported = (
    await client.query(
      "SELECT identity,data FROM tpa.event_participant_overrides WHERE event_key=$1 AND data->>'source'='imported' AND data->>'registrationStatus'='registered'",
      [eventId],
    )
  ).rows;
  const matches = imported.filter((row) =>
    rosterMatches(row.data, {
      ...identity,
      phone: details?.mobile || identity.phone,
    }),
  );
  if (matches.length > 1)
    throw new OperationError(
      "Several imported records match this attendee. Contact TPA to complete registration.",
      409,
    );
  const claimed = matches[0];
  const {
    rows: [count],
  } = await client.query(
    "SELECT count(*)::int AS n FROM tpa.event_registrations WHERE event_id=$1 AND status='registered'",
    [eventId],
  );
  if (!claimed && count.n + imported.length >= event.capacity)
    throw new OperationError("This event is full.", 409);
  const row = (
    await client.query(
      `INSERT INTO tpa.event_registrations(id,event_id,user_id,status,fee_paise,payment_status,payment_revision,registration_details)
     VALUES($1,$2,$3,'registered',$4,$5,$6,$7)
     ON CONFLICT(event_id,user_id) DO UPDATE SET status='registered',
     booking_revision=tpa.event_registrations.booking_revision+1,registered_at=now(),
     fee_paise=$4,payment_status=$5,payment_reference='',payment_note='',payment_revision=$6,
     registration_details=coalesce($7,tpa.event_registrations.registration_details),
     version=tpa.event_registrations.version+1 RETURNING *`,
      [
        randomUUID(),
        eventId,
        userId,
        event.fee_paise,
        event.fee_paise ? "pending" : "not_required",
        event.payment_revision,
        details,
      ],
    )
  ).rows[0];
  if (claimed) {
    const data = { ...claimed.data, id: row.id, source: "platform" };
    delete data.registrationStatus;
    delete data.attendance;
    await client.query(
      "UPDATE tpa.event_participant_overrides SET data=$3,version=version+1,updated_at=now() WHERE event_key=$1 AND identity=$2",
      [eventId, claimed.identity, JSON.stringify(data)],
    );
  }
  await client.query(
    "INSERT INTO tpa.event_booking_payment_configurations(registration_id,booking_revision,event_id,payment_revision,fee_paise) VALUES($1,$2,$3,$4,$5)",
    [
      row.id,
      row.booking_revision,
      eventId,
      row.payment_revision,
      row.fee_paise,
    ],
  );
  let registration = row;
  if (attachPaymentProof) {
    const payment = await recordRegistrationPayment(client, { id: userId, roles: [] }, {
      eventId, registrationId: row.id, source: "member", note: "",
    });
    await attachPaymentProof(payment.id, userId);
    registration = payment.registration;
  } else {
    await queueEventMail(client, userId, event.title, row.payment_status, row.id + "-" + row.version);
  }
  await audit(client, userId, "registration.created", row.id);
  return { registration, created: true };
}
