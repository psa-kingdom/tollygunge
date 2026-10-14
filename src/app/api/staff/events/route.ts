import { lockOperationalEvent, editableEvent, freezeEventPayment, snapshotAccounts } from "@/lib/event-operations";

import { randomUUID } from "node:crypto";

import { queueEventUpdate } from "@/lib/event-mail";

import { getDatabase } from "@/lib/database";

import { eventInput, record, uuid, version } from "@/domain/operations";

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

    await authorized(request, "events:manage");

    const value = new URL(request.url).searchParams.get("id");

    const id = value ? uuid(value) : null;

    return (

      await getDatabase().query(

        "SELECT e.*, (SELECT count(*)::int FROM tpa.event_registrations r WHERE r.event_id=e.id AND r.status='registered') AS registrations FROM tpa.events e WHERE ($1::uuid IS NULL OR e.id=$1) ORDER BY starts_at DESC LIMIT 200",

        [id],

      )

    ).rows;

  });

}

export async function POST(request: Request) {

  return operation(async () => {

    const actor = await authorized(request, "events:manage", true),

      raw = record(await jsonBody(request, 16000));

    return transaction(async (client) => {

      let row;

      if (raw.action === "publish" || raw.action === "cancel") {

        const id = uuid(raw.id),

          expected = version(raw.version);

        const prior=await lockOperationalEvent(client,id,expected);

        editableEvent(prior);

        const result = await client.query(

          "UPDATE tpa.events SET status=$3,version=version+1,updated_by=$4 WHERE id=$1 AND version=$2 AND status<> 'cancelled' AND ($3='cancelled' OR (status='draft' AND starts_at>now())) RETURNING *",

          [

            id,

            expected,

            raw.action === "publish" ? "published" : "cancelled",

            actor.id,

          ],

        );

        if (!result.rowCount)

          throw new OperationError(

            "Event changed, cancelled or already started. Reload before continuing.",

            409,

          );

        row = result.rows[0];

        if(raw.action === "publish") {

          if(row.fee_paise>0 && row.payment_account_ids !== null && !row.payment_account_ids.length) throw new OperationError("Choose a payment account.");

          await freezeEventPayment(client,row,actor.id,"Event publication");

          row=(await client.query("SELECT * FROM tpa.events WHERE id=$1",[id])).rows[0];

        }

      } else if (raw.action === "save") {

        const input = (() => { try { return eventInput(raw); } catch(error) { throw new OperationError(error instanceof Error ? error.message : "Check event details."); } })(),

          id = input.id ?? randomUUID();

        const values = [

          id,

          input.title,

          input.description,

          input.location,

          input.startsAt,

          input.endsAt,

          input.capacity,

          actor.id,

          input.registrationStartsAt,

          input.registrationEndsAt,

          input.feePaise,

          input.visibility,

          input.deliveryMode,

        ];

        if (input.id) {

          const prior = (

            await client.query(

              "SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE",

              [id],

            )

          ).rows[0];

          if (

            !prior ||

            prior.version !== input.version ||

            prior.status === "cancelled"

          )

            throw new OperationError(

              "Event changed or was cancelled. Reload.",

              409,

            );

          editableEvent(prior);

          const counts = (

            await client.query(

              "SELECT count(*)::int total,count(*) FILTER(WHERE status='registered')::int active FROM tpa.event_registrations WHERE event_id=$1",

              [id],

            )

          ).rows[0];

          if (

            counts.total &&

            (prior.fee_paise !== input.feePaise ||

              prior.visibility !== input.visibility)

          )

            throw new OperationError(

              "Fee and visibility cannot change after registrations exist.",

              409,

            );

          if (input.capacity < counts.active)

            throw new OperationError(

              "Capacity cannot be below existing registrations.",

              409,

            );

        }

        const result = input.id

          ? await client.query(

              "UPDATE tpa.events SET title=$2,description=$3,location=$4,starts_at=$5,ends_at=$6,capacity=$7,updated_by=$8,registration_starts_at=$9,registration_ends_at=$10,fee_paise=$11,visibility=$12,delivery_mode=$13,schedule_revision=schedule_revision+CASE WHEN starts_at IS DISTINCT FROM $5::timestamptz OR ends_at IS DISTINCT FROM $6::timestamptz OR title IS DISTINCT FROM $2 OR location IS DISTINCT FROM $4 THEN 1 ELSE 0 END,version=version+1 WHERE id=$1 AND version=$14 AND status<>'cancelled' RETURNING *",

              [...values, input.version],

            )

          : await client.query(

              "INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by,registration_starts_at,registration_ends_at,fee_paise,visibility,delivery_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",

              values,

            );

        if (!result.rowCount)

          throw new OperationError("Only the latest draft can be edited.", 409);

        row = (await client.query(

          `UPDATE tpa.events SET speakers=coalesce($2::jsonb,speakers),

            schedule_revision=schedule_revision+CASE WHEN reminders IS DISTINCT FROM coalesce($3::jsonb,reminders) THEN 1 ELSE 0 END,

            reminders=coalesce($3::jsonb,reminders) WHERE id=$1 RETURNING *`,

          [id, input.speakers === undefined ? null : JSON.stringify(input.speakers), input.reminders === undefined ? null : JSON.stringify(input.reminders)],

        )).rows[0];

      } else throw new OperationError("Invalid event action.");

      if (

        raw.action === "cancel" ||

        (raw.action === "save" && row.status === "published")

      )

        await queueEventUpdate(client, row);

      if (raw.action === "cancel") {

        const changed = (

          await client.query(

            "UPDATE tpa.event_registrations SET status='cancelled',payment_status=CASE WHEN payment_status IN ('paid','refunded','not_required') THEN payment_status ELSE 'cancelled' END,version=version+1 WHERE event_id=$1 AND status='registered' RETURNING id",

            [row.id],

          )

        ).rows;

        for (const r of changed)

          await audit(client, actor.id, "registration.event_cancelled", r.id);

      }

      if(raw.action==='save' && raw.paymentAccountIds!==undefined) {
        if(!Array.isArray(raw.paymentAccountIds) || raw.paymentAccountIds.length>10) throw new OperationError('Choose up to ten accounts.');
        const ids=[...new Set(raw.paymentAccountIds.map(uuid))];
        if(row.status==='draft') {
          await snapshotAccounts(client,ids);
          row=(await client.query('UPDATE tpa.events SET payment_account_ids=$2 WHERE id=$1 RETURNING *',[row.id,ids])).rows[0];
        } else if(JSON.stringify([...ids].sort())!==JSON.stringify([...(row.payment_account_ids??[])].sort())) throw new OperationError('Use the audited event payment configuration action to change published instructions.',409);
      }
      await audit(client, actor.id, `event.${String(raw.action)}`, row.id);

      return row;

    });

  });

}

