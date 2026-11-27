import "server-only";
import type { PoolClient } from "pg";
import { isDeepStrictEqual } from "node:util";
import { getDatabase } from "./database";
import { snapshotAccounts } from "./event-operations";
import type { OrganiserUpi } from "@/domain/organiser-upi";

type EventPayment = {
  id: string;
  organiser: string | null;
  status: string;
  payment_account_ids: string[] | null;
  payment_revision: number | null;
};
type Snapshot = {
  id: string;
  version: number;
  details: Record<string, unknown>;
};

export async function organiserPaymentSelection(
  client: Pick<PoolClient, "query">,
  event: EventPayment,
) {
  const linked = event.organiser
    ? ((
        await client.query(
          "SELECT id,version,active_snapshot AS details FROM tpa.payment_details WHERE organiser=$1 AND status='active' AND active_snapshot->>'method'='upi' ORDER BY id",
          [event.organiser],
        )
      ).rows as OrganiserUpi[])
    : [];
  const current =
    event.payment_revision === null
      ? null
      : (
          await client.query(
            "SELECT accounts FROM tpa.event_payment_configurations WHERE event_id=$1 AND revision=$2",
            [event.id, event.payment_revision],
          )
        ).rows[0];
  const currentAccounts = (current?.accounts ?? []) as Snapshot[];
  if (
    !linked.length &&
    !currentAccounts.some((account) => account.details.organiser)
  )
    return { linked, accounts: currentAccounts, changed: false };
  let manual: Snapshot[];
  if (current)
    manual = currentAccounts.filter((account) => !account.details.organiser);
  else
    manual = (
      await client.query(
        "SELECT id,version,active_snapshot AS details FROM tpa.payment_details WHERE organiser IS NULL AND status='active' AND ($1::uuid[] IS NULL OR id=ANY($1::uuid[])) ORDER BY id",
        [event.payment_account_ids],
      )
    ).rows;
  const accounts = [...manual, ...linked].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const prior = [...currentAccounts].sort((a, b) => a.id.localeCompare(b.id));
  return { linked, accounts, changed: !isDeepStrictEqual(accounts, prior) };
}

export async function syncOrganiserPayments<T extends EventPayment>(
  client: PoolClient,
  event: T,
  actorId: string,
): Promise<T> {
  if (event.status === "draft") {
    if (!event.organiser) return event;
    const linked = (
      await client.query(
        "SELECT id FROM tpa.payment_details WHERE organiser=$1 AND status='active' AND active_snapshot->>'method'='upi' ORDER BY id",
        [event.organiser],
      )
    ).rows;
    const oldIds = event.payment_account_ids;
    if (!linked.length && oldIds === null) return event;
    const manual =
      oldIds === null
        ? (
            await client.query(
              "SELECT id FROM tpa.payment_details WHERE organiser IS NULL AND status='active' ORDER BY id",
            )
          ).rows
        : (
            await client.query(
              "SELECT id FROM tpa.payment_details WHERE organiser IS NULL AND id=ANY($1::uuid[]) ORDER BY id",
              [oldIds],
            )
          ).rows;
    const ids = [
      ...new Set([...manual, ...linked].map((row) => row.id)),
    ].sort();
    if (oldIds !== null && isDeepStrictEqual([...oldIds].sort(), ids))
      return event;
    await snapshotAccounts(client, ids);
    return (
      await client.query(
        "UPDATE tpa.events SET payment_account_ids=$2 WHERE id=$1 RETURNING *",
        [event.id, ids],
      )
    ).rows[0];
  }
  const selection = await organiserPaymentSelection(client, event);
  if (!selection.changed) return event;
  const revision = (event.payment_revision ?? 0) + 1;
  await client.query(
    "INSERT INTO tpa.event_payment_configurations(event_id,revision,accounts,actor_id,reason) VALUES($1,$2,$3,$4,'Organiser UPI settings')",
    [event.id, revision, JSON.stringify(selection.accounts), actorId],
  );
  return (
    await client.query(
      "UPDATE tpa.events SET payment_revision=$2,payment_account_ids=$3 WHERE id=$1 RETURNING *",
      [event.id, revision, selection.accounts.map((account) => account.id)],
    )
  ).rows[0];
}

export async function eventOrganiserUpis(
  event: EventPayment,
  client: Pick<PoolClient, "query"> = getDatabase(),
) {
  const selection = await organiserPaymentSelection(client, event);
  let accounts: Snapshot[] = selection.linked.length ? selection.linked : selection.accounts;
  if (!accounts.length && event.payment_revision === null && event.payment_account_ids?.length) {
    accounts = (await client.query(
      "SELECT id,version,active_snapshot AS details FROM tpa.payment_details WHERE id=ANY($1::uuid[]) AND status='active' AND active_snapshot->>'method'='upi' AND (organiser IS NULL OR organiser=$2) ORDER BY id",
      [event.payment_account_ids, event.organiser],
    )).rows;
  }
  return accounts.flatMap(({ id, details }) =>
    details.method === "upi" && typeof details.upiId === "string" && details.upiId
      ? [{ id, details: { upiId: details.upiId, payee: String(details.payee ?? ""), organiser: String(details.organiser ?? details.label ?? "") } }]
      : [],
  );
}
