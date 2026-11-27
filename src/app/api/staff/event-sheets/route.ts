import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import {
  authorized,
  operation,
  transaction,
  jsonBody,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { boundedBody } from "@/domain/request-body";
import { importCells } from "@/domain/onboarding-import";
import { email, mobile, clean } from "@/domain/member-foundation";
import {
  rosterIdentity,
  rosterMatches,
  type RosterRow,
} from "@/domain/event-roster";
import { eventRoster, rosterFingerprint } from "@/lib/event-roster";
import { membershipPlans } from "@/lib/membership-plans";

const headers = [
  "Name",
  "Email",
  "Mobile",
  "Membership number",
  "Membership plan",
  "Organisation",
];
type PreviewRow = {
  row: number;
  record: RosterRow;
  error?: string;
  action: string;
};
function scope(url: URL) {
  const eventKey = url.searchParams.get("eventKey") || "",
    mode = url.searchParams.get("mode");
  if (
    !["registrations", "attendance"].includes(mode || "") ||
    !/^(?:[a-f0-9-]{36}|\d{4}-\d{2}-\d{2})$/i.test(eventKey)
  )
    throw new OperationError("Choose an event and a record type.");
  return { eventKey, mode: mode as "registrations" | "attendance" };
}

export async function GET(request: Request) {
  let selected: ReturnType<typeof scope> | undefined;
  const check = await operation(async () => {
    await authorized(request, "events:manage");
    selected = scope(new URL(request.url));
    await eventRoster(getDatabase(), selected.eventKey);
    return true;
  });
  if (!check.ok || !selected) return check;
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet(
      selected.mode === "attendance" ? "Attendance" : "Registrations",
    );
  sheet.addRow([
    ...headers,
    selected.mode === "attendance" ? "Attendance" : "Registration status",
  ]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17364E" },
  };
  sheet.getRow(1).height = 26;
  [28, 36, 22, 24, 24, 30, 24].forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  sheet.getColumn(3).numFmt = "@";
  sheet.getColumn(4).numFmt = "@";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const rows = await eventRoster(getDatabase(), selected.eventKey);
  for (const row of rows)
    sheet.addRow([
      row.name,
      row.email,
      row.phone,
      row.number,
      row.plan,
      row.organisation,
      selected.mode === "attendance"
        ? row.attendance
        : row.registrationStatus === "historical"
          ? ""
          : row.registrationStatus,
    ]);
  const bytes = await book.xlsx.writeBuffer();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="event-${selected.mode}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const { eventKey, mode } = scope(new URL(request.url));
      const bytes = await boundedBody(request, 5 * 1024 * 1024 + 65536);
      const form = await new Response(bytes as BodyInit, {
        headers: { "Content-Type": request.headers.get("content-type")! },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw new OperationError("Choose CSV or XLSX up to 5 MB.");
      let cells: Awaited<ReturnType<typeof importCells>>;
      try {
        cells = await importCells(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
        );
      } catch (error) {
        throw new OperationError((error as Error).message);
      }
      const expected = [
        ...headers,
        mode === "attendance" ? "Attendance" : "Registration status",
      ];
      if (
        cells.length < 2 ||
        cells[0].length !== 7 ||
        cells[0].some(
          (value, i) =>
            value.trim().toLowerCase() !== expected[i].toLowerCase(),
        )
      )
        throw new OperationError(
          "Use the downloaded sheet with all seven columns in the same order.",
        );
      const base = await eventRoster(getDatabase(), eventKey),
        plans = await membershipPlans(true);
      const seen = new Set<string>();
      const preview: PreviewRow[] = cells.slice(1).map((values, i) => {
        let record: RosterRow = {
          id: "",
          name: "",
          email: "",
          phone: "",
          number: "",
          plan: "",
          organisation: "",
          registrationStatus: "historical",
          attendance: "Not recorded",
          source: "imported",
        };
        let action = "Add record",
          error: string | undefined;
        try {
          const incoming = {
            name: clean(values[0], "name", 120),
            email: email(values[1]),
            phone: mobile(values[2]),
            number: clean(values[3], "membership number", 80),
          };
          if (!incoming.email && !incoming.phone && !incoming.number)
            throw Error(
              "Provide an email, mobile or membership number to match the attendee.",
            );
          const matches = base.filter((row) => rosterMatches(row, incoming));
          if (matches.length > 1)
            throw Error(
              "This identity matches several attendees. Correct the identifiers.",
            );
          if (mode === "attendance" && !matches.length)
            throw Error(
              "Add this attendee in Registrations before updating attendance.",
            );
          const existing = matches[0];
          record = {
            ...record,
            ...existing,
            ...Object.fromEntries(
              Object.entries(incoming).filter(([, value]) => Boolean(value)),
            ),
          };
          if (!record.name) throw Error("Enter the attendee name.");
          action = existing ? "Update record" : "Add record";
          const identity = rosterIdentity(record);
          if (seen.has(identity))
            throw Error("This attendee appears more than once in the sheet.");
          seen.add(identity);
          const plan = clean(values[4], "membership plan", 80);
          if (plan) {
            const exactCode = plans.find(
              (item) => item.code.toLowerCase() === plan.toLowerCase(),
            );
            const names = plans.filter(
              (item) => item.name.toLowerCase() === plan.toLowerCase(),
            );
            const activeNames = names.filter((item) => item.active !== false);
            const matches = exactCode
              ? [exactCode]
              : activeNames.length
                ? activeNames
                : names;
            if (matches.length !== 1)
              throw Error("Choose a membership plan listed in Settings.");
            record.plan = matches[0].code;
          }
          if (values[5]?.trim())
            record.organisation = clean(values[5], "organisation", 160);
          const state = String(values[6] ?? "")
            .trim()
            .toLowerCase();
          if (mode === "attendance") {
            const states: Record<string, RosterRow["attendance"]> = {
              attended: "Attended",
              present: "Attended",
              absent: "Not attended",
              "not attended": "Not attended",
              "not recorded": "Not recorded",
              unmarked: "Not recorded",
            };
            if (!(state in states))
              throw Error("Use Attended, Not attended or Not recorded.");
            record.attendance = states[state];
            if (
              record.live &&
              record.attendance !== "Not recorded" &&
              (record.live.status !== "registered" ||
                !["paid", "not_required"].includes(record.live.payment_status))
            )
              throw Error(
                "Attendance requires an active registration with confirmed payment.",
              );
          } else {
            if (state && !["registered", "cancelled"].includes(state))
              throw Error("Use registered or cancelled.");
            record.registrationStatus =
              state || existing?.registrationStatus || "registered";
            if (
              record.live &&
              record.live.status === "cancelled" &&
              record.registrationStatus === "registered"
            )
              throw Error(
                "Rebook cancelled registrations through the event registration flow.",
              );
          }
        } catch (failure) {
          error =
            failure instanceof Error && "fieldErrors" in failure
              ? Object.values(
                  failure.fieldErrors as Record<string, string>,
                ).join(" ")
              : (failure as Error).message;
        }
        return {
          row: cells.sourceRows?.[i + 1] ?? i + 2,
          record,
          action,
          error,
        };
      });
      return transaction(async (client) => {
        const id = randomUUID();
        await client.query(
          "INSERT INTO tpa.event_sheet_imports(id,actor_id,event_key,mode,rows,baseline) VALUES($1,$2,$3,$4,$5,$6)",
          [
            id,
            actor.id,
            eventKey,
            mode,
            JSON.stringify(preview),
            JSON.stringify({ hash: rosterFingerprint(base) }),
          ],
        );
        return { id, rows: preview };
      });
    }
    const input = await jsonBody(request, 1024);
    if (input.action !== "confirm" || typeof input.id !== "string")
      throw new OperationError("Choose a sheet preview.");
    return transaction(async (client) => {
      const batch = (
        await client.query(
          "SELECT * FROM tpa.event_sheet_imports WHERE id::text=$1 AND actor_id=$2 FOR UPDATE",
          [input.id, actor.id],
        )
      ).rows[0];
      if (!batch) throw new OperationError("Preview not found.", 404);
      if (batch.committed_at) return { saved: true, alreadyImported: true };
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,7620))",
        [batch.event_key],
      );
      const live = /^[a-f0-9-]{36}$/i.test(batch.event_key);
      const event = live
        ? (
            await client.query(
              "SELECT * FROM tpa.events WHERE id::text=$1 FOR UPDATE",
              [batch.event_key],
            )
          ).rows[0]
        : null;
      if (live && (!event || event.archived_at || event.status === "cancelled"))
        throw new OperationError("This event cannot be updated.", 409);
      if (batch.mode === "attendance" && event?.attendance_finalized_at)
        throw new OperationError(
          "Attendance is finalized. Reopen it before importing corrections.",
          409,
        );
      const current = await eventRoster(client, batch.event_key);
      if (rosterFingerprint(current) !== batch.baseline.hash)
        throw new OperationError(
          "Event records changed after preview. Upload the sheet again.",
          409,
        );
      const rows = batch.rows as PreviewRow[];
      if (
        batch.mode === "attendance" &&
        event &&
        new Date(event.starts_at).getTime() > Date.now() &&
        rows.some((row) => row.record.attendance !== "Not recorded")
      )
        throw new OperationError(
          "Record attendance after the event starts.",
          409,
        );
      if (rows.some((row) => row.error))
        throw new OperationError("Correct the invalid rows and upload again.");
      const overrides = (
        await client.query(
          "SELECT identity,data FROM tpa.event_participant_overrides WHERE event_key=$1 ORDER BY updated_at DESC,identity",
          [batch.event_key],
        )
      ).rows;
      for (const { record } of rows) {
        if (record.live) {
          const registration = record.live;
          if (
            batch.mode === "registrations" &&
            registration.status !== record.registrationStatus &&
            ["paid", "refunded"].includes(registration.payment_status)
          )
            throw new OperationError(
              "Paid registration status changes require staff payment review.",
              409,
            );
          if (batch.mode === "attendance") {
            const outcome =
              record.attendance === "Attended"
                ? "attended"
                : record.attendance === "Not attended"
                  ? "absent"
                  : "unmarked";
            await client.query(
              `INSERT INTO tpa.event_attendance(registration_id,outcome,checked_in_by,checked_in_at,note)
              VALUES($1,$2,$3,now(),'Excel attendance import')
              ON CONFLICT(registration_id) DO UPDATE SET outcome=$2,checked_in_by=$3,
              checked_in_at=CASE WHEN $2='attended' AND tpa.event_attendance.outcome<>'attended' THEN now() ELSE tpa.event_attendance.checked_in_at END,
              note='Excel attendance import',version=tpa.event_attendance.version+1
              WHERE tpa.event_attendance.outcome IS DISTINCT FROM $2`,
              [registration.id, outcome, actor.id],
            );
          } else {
            const original = registration.registration_details ?? {};
            const [firstName, ...lastName] = record.name.split(/\s+/);
            const details = {
              ...original,
              firstName,
              lastName: lastName.join(" "),
              mobile: record.phone,
              organization: record.organisation,
            };
            await client.query(
              "UPDATE tpa.event_registrations SET registration_details=$2,status=$3,payment_status=CASE WHEN $3='cancelled' AND payment_status NOT IN ('paid','refunded','not_required') THEN 'cancelled' ELSE payment_status END,version=version+1 WHERE id=$1",
              [registration.id, details, record.registrationStatus],
            );
          }
        }
        const { live: _live, ...data } = record;
        void _live;
        if (record.live) {
          delete (data as Partial<RosterRow>).attendance;
          delete (data as Partial<RosterRow>).registrationStatus;
        }
        const prior = overrides.find(
          (override) =>
            rosterMatches(override.data, record) ||
            (record.id && override.data.id === record.id),
        );
        const identity =
          prior?.identity ??
          (record.id
            ? record.id.startsWith("imported:")
              ? record.id.slice(9)
              : "id:" + record.id
            : rosterIdentity(record));
        await client.query(
          `INSERT INTO tpa.event_participant_overrides(event_key,identity,data,updated_by) VALUES($1,$2,$3,$4)
          ON CONFLICT(event_key,identity) DO UPDATE SET data=$3,updated_by=$4,updated_at=now(),version=tpa.event_participant_overrides.version+1`,
          [batch.event_key, identity, JSON.stringify(data), actor.id],
        );
      }
      if (event && batch.mode === "attendance") {
        await client.query(
          "UPDATE tpa.event_badges b SET revoked_at=now() FROM tpa.event_registrations r WHERE r.id=b.registration_id AND r.event_id=$1 AND (r.status<>'registered' OR r.payment_status NOT IN ('paid','not_required') OR NOT EXISTS(SELECT 1 FROM tpa.event_attendance a WHERE a.registration_id=r.id AND a.outcome='attended'))",
          [event.id],
        );
        await client.query(
          "INSERT INTO tpa.event_badges(registration_id) SELECT r.id FROM tpa.event_registrations r JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE r.event_id=$1 AND r.status='registered' AND r.payment_status IN ('paid','not_required') AND a.outcome='attended' ON CONFLICT(registration_id) DO UPDATE SET revoked_at=NULL",
          [event.id],
        );
      }
      await client.query(
        "UPDATE tpa.event_sheet_imports SET committed_at=now() WHERE id=$1",
        [batch.id],
      );
      await audit(
        client,
        actor.id,
        "event." + batch.mode + "_imported",
        batch.event_key,
      );
      return { saved: true, count: rows.length };
    });
  });
}
