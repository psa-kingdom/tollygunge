"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "./navigation-link";
import { CopyValue, StatusBadge, type StatusTone } from "./portal-values";
import { ProfilePreview, ProfileInspector } from "./profile-preview";
import { WorkspaceEmptyState } from "./workspace-ui";
import { eventTime } from "@/domain/event-flow";

type EventChoice = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
};
type Participant = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  membership_number: string | null;
  status: string;
  payment_status: string;
  fee_paise: number;
  outcome: string;
  registered_at: string;
  checked_in_at: string | null;
  attendance_note: string;
};
type Roster = {
  rows: Participant[];
  total: number;
  page: number;
  pageSize: number;
};
const labels: Record<string, string> = {
  registered: "Registered",
  confirmed: "Confirmed registration",
  cancelled: "Cancelled",
  paid: "Payment verified",
  pending: "Payment pending",
  failed: "Payment needs attention",
  refunded: "Refund recorded",
  not_required: "No payment required",
  attended: "Attended",
  absent: "Absent",
  unmarked: "Not recorded",
};
function tone(value: string): StatusTone {
  return ["paid", "attended"].includes(value)
    ? "success"
    : value === "registered"
      ? "active"
      : value === "pending"
        ? "pending"
        : value === "failed"
          ? "error"
          : "neutral";
}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Unable to load participants.");
  return data;
}
export function EventParticipants({
  tab,
  canVerifyPayments = false,
}: {
  tab: "registrations" | "payments" | "attendance";
  canVerifyPayments?: boolean;
}) {
  const router = useRouter(),
    query = useSearchParams();
  const [events, setEvents] = useState<EventChoice[]>(),
    [eventError, setEventError] = useState(""),
    [eventRetry, setEventRetry] = useState(0);
  const [search, setSearch] = useState(""),
    [applied, setApplied] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [roster, setRoster] = useState<{
    key: string;
    data?: Roster;
    error?: string;
  }>();
  const [selection, setSelection] = useState<{ key: string; id: string }>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const eventId = query.get("eventId") ?? events?.[0]?.id ?? "";
  const event = events?.find((item) => item.id === eventId);
  const params = new URLSearchParams({
    eventId,
    page: String(page),
    search: applied,
    [tab === "payments"
      ? "payment"
      : tab === "attendance"
        ? "attendance"
        : "registration"]: filter,
  });
  const key = params.toString();
  const current = roster?.key === key ? roster : undefined;
  const selected =
    selection?.key === key
      ? current?.data?.rows.find((row) => row.id === selection.id)
      : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void read<EventChoice[]>("/api/staff/events", controller.signal)
      .then(setEvents)
      .catch((error) => {
        if (!controller.signal.aborted) setEventError(error.message);
      });
    return () => controller.abort();
  }, [eventRetry]);
  useEffect(() => {
    if (!event) return;
    const controller = new AbortController();
    void read<Roster>("/api/staff/attendance?" + key, controller.signal)
      .then((data) => setRoster({ key, data }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setRoster({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, event, retry]);
  const options =
    tab === "payments"
      ? [
          "all",
          "paid",
          "pending",
          "failed",
          "refunded",
          "cancelled",
          "not_required",
        ]
      : tab === "attendance"
        ? ["all", "attended", "absent", "unmarked"]
        : ["all", "registered", "confirmed", "cancelled"];
  const title =
    tab === "payments"
      ? "Participant payment status"
      : tab === "attendance"
        ? "Participant attendance"
        : "Event registrations";
  return (
    <section className="participant-directory" data-portal-primary>
      <div className="participant-heading">
        <div>
          <h2>{title}</h2>
          <p>
            Event participation is separate from association membership and
            professional verification.
          </p>
        </div>
        {event && (
          <Link
            className="button secondary"
            href={"/admin/workspaces/events?id=" + event.id}
          >
            Manage this event →
          </Link>
        )}
      </div>
      {eventError ? (
        <p role="alert">
          {eventError}{" "}
          <button
            className="text-button"
            onClick={() => {
              setEventError("");
              setEventRetry((value) => value + 1);
            }}
          >
            Reload workspace
          </button>
        </p>
      ) : !events ? (
        <p role="status">Loading events…</p>
      ) : !events.length ? (
        <WorkspaceEmptyState
          icon="calendar"
          title="No events available"
          description="Published, draft and historical events will appear here when available to your role."
          actionLabel="Open event workspace"
          href="/admin/workspaces/events"
        />
      ) : (
        <>
          <form
            className="participant-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(search);
              setPage(1);
            }}
          >
            <label>
              Event
              <select
                value={event?.id ?? ""}
                onChange={(e) => {
                  const next = new URLSearchParams({
                    view: "participants",
                    tab,
                    eventId: e.target.value,
                  });
                  setPage(1);
                  router.push("/admin/workspaces/events?" + next);
                }}
              >
                <option value="" disabled>
                  Choose an event
                </option>
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {eventTime(item.starts_at)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search participants
              <input
                value={search}
                maxLength={120}
                placeholder="Name, email, phone or membership number"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              {tab === "payments"
                ? "Payment status"
                : tab === "attendance"
                  ? "Attendance status"
                  : "Registration status"}
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value === "all"
                      ? "All statuses"
                      : (labels[value] ?? "Confirmed registration")}
                  </option>
                ))}
              </select>
            </label>
            <button className="button">Search participants</button>
          </form>
          {!event ? (
            <p role="status">
              Choose an available event to see its participants.
            </p>
          ) : current?.error ? (
            <p role="alert">
              {current.error}{" "}
              <button
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry participants
              </button>
            </p>
          ) : !current?.data ? (
            <p role="status">Loading participants…</p>
          ) : (
            <>
              <p className="participant-count">
                {current.data.total}{" "}
                {current.data.total === 1 ? "registration" : "registrations"} ·{" "}
                {event.title}
              </p>
              {!current.data.rows.length ? (
                <WorkspaceEmptyState
                  icon="people"
                  title="No participants match these filters"
                  description="Choose another event or reset the search and status filters."
                  actionLabel="Reset participant filters"
                  onAction={() => {
                    setSearch("");
                    setApplied("");
                    setFilter("all");
                    setPage(1);
                  }}
                />
              ) : (
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Event participant records"
                  tabIndex={0}
                >
                  <table className="operations-table">
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Membership no.</th>
                        <th>
                          {tab === "payments"
                            ? "Payment"
                            : tab === "attendance"
                              ? "Attendance"
                              : "Registration"}
                        </th>
                        <th>
                          {tab === "payments"
                            ? "Booked fee"
                            : tab === "attendance"
                              ? "Check-in"
                              : "Registered on"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.data.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <ProfilePreview
                              profile={{
                                name: row.name,
                                email: row.email,
                                phone: row.mobile ?? undefined,
                                number: row.membership_number ?? undefined,
                              }}
                              disabled={Boolean(selected)}
                              selected={selected?.id === row.id}
                              onPin={(button) => {
                                trigger.current = button;
                                setSelection({ key, id: row.id });
                              }}
                            />
                            <div className="member-record-contact">
                              <CopyValue value={row.email} />
                            </div>
                          </td>
                          <td>
                            {row.membership_number ? (
                              <CopyValue
                                value={row.membership_number}
                                label="membership number"
                              />
                            ) : (
                              "No membership recorded"
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              tone={tone(
                                tab === "payments"
                                  ? row.payment_status
                                  : tab === "attendance"
                                    ? row.outcome
                                    : row.status,
                              )}
                            >
                              {labels[
                                tab === "payments"
                                  ? row.payment_status
                                  : tab === "attendance"
                                    ? row.outcome
                                    : row.status
                              ] ?? "Unavailable"}
                            </StatusBadge>
                          </td>
                          <td>
                            {tab === "payments"
                              ? Number.isFinite(row.fee_paise)
                                ? new Intl.NumberFormat("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                  }).format(row.fee_paise / 100)
                                : "Unavailable"
                              : tab === "attendance"
                                ? row.checked_in_at
                                  ? eventTime(row.checked_in_at)
                                  : "Not recorded"
                                : eventTime(row.registered_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="action-row">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous participants
                </button>
                <span>Page {page}</span>
                <button
                  className="button secondary"
                  disabled={page * current.data.pageSize >= current.data.total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next participants
                </button>
                {tab === "payments" && canVerifyPayments && (
                  <Link
                    className="button secondary"
                    href="/admin/workspaces/payments"
                  >
                    Open manual payment verification →
                  </Link>
                )}
              </div>
            </>
          )}
        </>
      )}
      {selected && (
        <ProfileInspector
          label={selected.name + " participant details"}
          returnFocus={trigger}
          onClose={() => setSelection(undefined)}
        >
          <h2 tabIndex={-1}>{selected.name}</h2>
          <p>{event?.title}</p>
          <dl>
            <dt>Email</dt>
            <dd>
              <CopyValue value={selected.email} />
            </dd>
            <dt>Phone</dt>
            <dd>
              <CopyValue value={selected.mobile} />
            </dd>
            <dt>Membership number</dt>
            <dd>
              <CopyValue value={selected.membership_number} />
            </dd>
            <dt>Registration reference</dt>
            <dd>
              <CopyValue value={selected.id} />
            </dd>
            <dt>Registration</dt>
            <dd>{labels[selected.status] ?? selected.status}</dd>
            <dt>Event payment</dt>
            <dd>{labels[selected.payment_status] ?? "Unavailable"}</dd>
            <dt>Attendance</dt>
            <dd>{labels[selected.outcome] ?? "Not recorded"}</dd>
          </dl>
          {selected.attendance_note && <p>{selected.attendance_note}</p>}
        </ProfileInspector>
      )}
    </section>
  );
}
