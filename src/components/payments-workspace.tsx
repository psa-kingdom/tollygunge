"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "./operations-client";
import { WorkspaceEmptyState, WorkspacePanel } from "./workspace-ui";
import {
  balanceLabel,
  financeTotals,
  financeEventPeriod,
  financeMonths,
  financePeriodLabel,
  matchesFinanceEvent,
  rupees,
  type FinanceLine,
} from "@/domain/finance";
import styles from "./finance.module.css";
type Entry = {
  id: string;
  event_id: string;
  event_title: string;
  kind: string;
  source: string;
  registration_id: string | null;
  label: string;
  amount_paise: number;
  entry_date: string;
  method: string;
  reference: string;
  note: string;
  status: string;
  version: number;
  created_by: string;
  created_at: string;
  reviewed_at: string | null;
  creator_name: string;
  reviewer_name: string;
  review_note: string;
  replaces_id: string | null;
  proof_id: string | null;
  proof_type: string | null;
  lines: FinanceLine[];
  allLines?: FinanceLine[];
  participant_name: string | null;
  manual_participant_name: string | null;
  history: {
    action: string;
    created_at: string;
    actor: string;
    details: { reason?: string };
  }[];
};
const approvalDateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function submissionDates(entry: Entry) {
  const submitted =
    entry.history.filter((item) => item.action === "submitted").at(-1)
      ?.created_at ??
    (entry.source !== "legacy" ? entry.created_at : undefined);
  const approved = entry.status === "approved" ? entry.reviewed_at : null;
  return { submitted, approved };
}

function approvalStatus(entry: Entry) {
  if (entry.status === "submitted") return "Pending approval";
  if (entry.status === "approved") return "Approved";
  if (entry.status === "returned")
    return entry.source === "member" ? "Rejected" : "Returned";
  return entry.status;
}

type Data = {
  filters: { eventId: string | null };
  entries: Entry[];
  events: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string;
    status: string;
    participant_count: number;
    completed_at: string | null;
    archived_at: string | null;
  }[];
  registrations: {
    id: string;
    name: string;
    fee_paise: number;
    payment_status: string;
    status: string;
  }[];
  actorId: string;
  reviewer: boolean;
  totals: {
    received: number;
    refunded: number;
    expenses: number;
    netResult: number;
    pendingReceipts: number;
    pendingExpenses: number;
  };
};
const emptyLine = (): FinanceLine => ({
  header: "",
  description: "",
  date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  amountPaise: 0,
  vendor: "",
  note: "",
});
export function PaymentsWorkspace() {
  return <FinanceWorkspace />;
}
export function FinanceWorkspace({
  eventId: fixedEventId,
  onSaved,
}: {
  eventId?: string;
  onSaved?: () => Promise<void>;
}) {
  const eventId = fixedEventId;
  const [tab, setTab] = useState(fixedEventId ? "Expenses" : "Overview"),
    [eventQuery, setEventQuery] = useState(""),
    [eventMonths, setEventMonths] = useState<string[]>([]),
    [eventYear, setEventYear] = useState(""),
    [eventView, setEventView] = useState<"cards" | "list">("cards"),
    [data, setData] = useState<Data>(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [sheet, setSheet] = useState<Entry | null>(),
    [lines, setLines] = useState<FinanceLine[]>([emptyLine()]),
    [editReceipt, setEditReceipt] = useState<Entry | null>(null),
    [review, setReview] = useState<Entry | null>(null),
    [showCollection, setShowCollection] = useState(false),
    [collectionKind, setCollectionKind] = useState("receipt"),
    [collectionParticipant, setCollectionParticipant] = useState("");
  const params = new URLSearchParams(
      fixedEventId ? { eventId: fixedEventId } : {},
    ),
    path = "/api/staff/finance?" + params;
  async function reload() {
    setData(await api<Data>(path));
  }
  useEffect(() => {
    let active = true;
    api<Data>(path)
      .then((d) => {
        if (active) {
          setData(d);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await reload();
      await onSaved?.();
      setMessage(
        "Saved. Entries awaiting approval are shown separately from approved totals.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tabs = fixedEventId
    ? ["Expenses", "Participant collections"]
    : ["Overview", "Approvals"];
  const event = data?.events.find((e) => e.id === eventId),
    closed = !!(
      event?.completed_at ||
      event?.archived_at ||
      event?.status === "cancelled"
    );
  const writer = !!data && !data.reviewer && !closed,
    formData = data,
    formReady = formData?.filters.eventId === eventId;
  const submissions =
    data?.entries.filter(
      (entry) =>
        ["submitted", "approved", "returned"].includes(entry.status) &&
        (data.reviewer ? entry.source !== "member" : entry.source === "member"),
    ) ?? [];
  const pending = submissions.filter((entry) => entry.status === "submitted");
  const reviewed = submissions.filter((entry) => entry.status !== "submitted");
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const reviewHeadingId = useId();
  const reviewEvent = data?.events.find(
    (event) => event.id === review?.event_id,
  );
  const reviewClosed = !!(
    reviewEvent?.completed_at ||
    reviewEvent?.archived_at ||
    reviewEvent?.status === "cancelled"
  );
  useEffect(() => {
    const dialog = reviewDialog.current;
    if (!review || !dialog) return;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("h2")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [review]);
  function openReview(entry: Entry) {
    setMessage("");
    setReview(entry);
  }
  const receipts = data?.entries.filter((e) => e.kind !== "expenses") ?? [],
    sheets = data?.entries.filter((e) => e.kind === "expenses") ?? [];
  const moneyCell = (value: number) => (
    <span className={styles.amount}>{rupees(Number(value))}</span>
  );
  const eventFilters = { q: eventQuery, months: eventMonths, year: eventYear };
  const visibleEvents =
    data?.events.filter((event) => matchesFinanceEvent(event, eventFilters)) ??
    [];
  const eventYears = [
    ...new Set(
      data?.events.map((event) => financeEventPeriod(event.starts_at).year),
    ),
  ]
    .sort()
    .reverse();
  async function downloadReport(format: string, query: URLSearchParams) {
    const response = await fetch(
      "/api/staff/finance/export?" + query + "&format=" + format,
    );
    if (!response.ok)
      throw Error((await response.json()).error ?? "Export failed.");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `tpa-finance.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const selectedRegistration = formData?.registrations.find(
    (r) => r.id === collectionParticipant,
  );
  function beginSheet(e?: Entry) {
    setShowCollection(false);
    setReview(null);
    setSheet(e ?? null);
    setLines(
      e
        ? (e.allLines ?? e.lines).map((l) => ({ ...emptyLine(), ...l }))
        : [emptyLine()],
    );
    setTab("Expenses");
  }
  function openCollection(participant = "") {
    setSheet(undefined);
    setTab("Participant collections");
    setReview(null);
    setCollectionParticipant(participant);
    setCollectionKind(participant ? "registered" : "receipt");
    setEditReceipt(null);
    setShowCollection(true);
  }
  const receiptTable = (entries: Entry[]) => (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Event receipts"
    >
      <table className="operations-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event / participant or source</th>
            <th>Reference</th>
            <th>Origin / status</th>
            <th className={styles.number}>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{String(e.entry_date).slice(0, 10)}</td>
              <td>
                {e.event_title}
                <small>
                  {e.participant_name ?? e.label} ·{" "}
                  {e.kind === "refund"
                    ? "Refund"
                    : e.participant_name
                      ? "Participant fee"
                      : "Other funds"}
                </small>
              </td>
              <td>
                {e.reference}
                <small>{e.method}</small>
              </td>
              <td>
                {e.source === "legacy" ? "Legacy approved" : e.source}
                <small>{e.status}</small>
              </td>
              <td className={styles.number}>{moneyCell(e.amount_paise)}</td>
              <td>
                <button className="link-button" onClick={() => openReview(e)}>
                  View {e.status === "submitted" ? " / review" : ""}
                </button>
                {writer &&
                  e.source !== "member" &&
                  e.status === "returned" &&
                  e.created_by === data?.actorId && (
                    <button
                      onClick={() => {
                        setEditReceipt(e);
                        setShowCollection(true);
                      }}
                    >
                      Revise
                    </button>
                  )}
                {writer && e.status === "approved" && (
                  <button
                    onClick={() => {
                      setEditReceipt(e);
                      setShowCollection(true);
                    }}
                  >
                    Correct
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>Approved receipts net of refunds</th>
            <td className={styles.number}>
              {moneyCell(financeTotals(entries).netCollected)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      {!entries.length && <p>No receipts in this selection.</p>}
    </div>
  );
  return (
    <div className={styles.finance}>
      {fixedEventId && (
        <header className={styles.eventHeading}>
          <div className={styles.eventIdentity}>
            <Link href="/admin/workspaces/payments">← Back to Finance</Link>
            <h1>{event?.title ?? "Event finance"}</h1>
            {event && (
              <p>
                {new Date(event.starts_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                })}{" "}
                · {event.location || "Venue not specified"} ·{" "}
                {event.participant_count}{" "}
                {event.participant_count === 1 ? "participant" : "participants"}
              </p>
            )}
          </div>
          {data && (
            <dl
              className={styles.eventTotals}
              aria-label="Event financial summary"
            >
              <div>
                <dt>Total collected</dt>
                <dd>{rupees(data.totals.received)}</dd>
              </div>
              <div>
                <dt>Total expenses</dt>
                <dd>{rupees(data.totals.expenses)}</dd>
              </div>
              <div>
                <dt>Net balance</dt>
                <dd>{balanceLabel(data.totals.netResult)}</dd>
              </div>
            </dl>
          )}
        </header>
      )}
      <div className={styles.navigationRow}>
        <div
          className="workspace-tabs"
          role="tablist"
          aria-label={fixedEventId ? "Event finance views" : "Finance views"}
        >
          {tabs.map((t, index) => (
            <button
              key={t}
              id={`finance-${fixedEventId ?? "all"}-${index}`}
              aria-controls={`finance-panel-${fixedEventId ?? "all"}`}
              role="tab"
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => {
                setTab(t);
                setReview(null);
              }}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const n =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? tabs.length - 1
                      : (index +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          tabs.length) %
                        tabs.length;
                setTab(tabs[n]);
                document
                  .getElementById(`finance-${fixedEventId ?? "all"}-${n}`)
                  ?.focus();
              }}
            >
              {t}
              {t === "Approvals" && pending.length
                ? ` (${pending.length})`
                : ""}
            </button>
          ))}
        </div>
        {data && fixedEventId && (
          <div className={styles.headerActions}>
            {fixedEventId && !data.reviewer && (
              <button
                className="button"
                onClick={() => {
                  if (closed) {
                    setTab("Expenses");
                    setMessage("Reopen this event before adding expenses.");
                    return;
                  }
                  if (sheet === undefined) beginSheet();
                  else setTab("Expenses");
                }}
              >
                Add Expense
              </button>
            )}
            {!data.reviewer && (
              <button
                className="button"
                disabled={busy || closed}
                onClick={() => openCollection()}
              >
                Add fee collection
              </button>
            )}
            {fixedEventId &&
              ["pdf", "xlsx"].map((format) => (
                <button
                  key={format}
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void run(() => downloadReport(format, params))}
                >
                  Export {format === "xlsx" ? "Excel" : "PDF"}
                </button>
              ))}
          </div>
        )}
      </div>
      {message && !review && <p role="status">{message}</p>}
      {!data && <p>Loading finance…</p>}
      {closed && (
        <p className="notice">
          This event is closed. Reopen it before adding or correcting financial
          records.
        </p>
      )}
      <div
        role="tabpanel"
        id={`finance-panel-${fixedEventId ?? "all"}`}
        aria-labelledby={`finance-${fixedEventId ?? "all"}-${tabs.indexOf(tab)}`}
      >
        {data && !fixedEventId && tab === "Overview" && (
          <>
            <div className={styles.totals}>
              {[
                [
                  fixedEventId ? "Total collected" : "Total collected till now",
                  data.totals.received,
                ],
                [
                  fixedEventId ? "Total expenses" : "Total expenses till now",
                  data.totals.expenses,
                ],
                [
                  fixedEventId ? "Total refunds" : "Total refunds till now",
                  data.totals.refunded,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{rupees(Number(value))}</strong>
                </div>
              ))}
              <div>
                <span>
                  {fixedEventId
                    ? "Net balance"
                    : "Total surplus / deficit till now"}
                </span>
                <strong>{balanceLabel(data.totals.netResult)}</strong>
              </div>
            </div>
            <p className={styles.basis}>
              Approved entries only. Awaiting approval: collections{" "}
              {rupees(data.totals.pendingReceipts)} · expenses{" "}
              {rupees(data.totals.pendingExpenses)}.
            </p>
          </>
        )}
        {showCollection && writer && eventId && formReady && (
          <WorkspacePanel
            title={
              editReceipt ? "Revise receipt / refund" : "Add fee collection"
            }
          >
            <form
              key={editReceipt?.id ?? eventId}
              className="member-settings"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  refund = f.get("kind") === "refund";
                const body = {
                  id: crypto.randomUUID(),
                  eventId,
                  registrationId: f.get("registrationId") || undefined,
                  label:
                    f.get("label") || editReceipt?.label || "Participant fee",
                  participantName: f.get("participantName") ?? undefined,
                  amountPaise: Math.round(Number(f.get("amount")) * 100),
                  date: f.get("date"),
                  method: f.get("method"),
                  reference: f.get("reference"),
                  note: f.get("note"),
                };
                void run(async () => {
                  if (editReceipt) {
                    await api("/api/staff/finance", {
                      ...body,
                      action:
                        editReceipt.status === "returned"
                          ? "entry.resubmit"
                          : editReceipt.kind === "refund"
                            ? "refund.correct"
                            : "receipt.correct",
                      existingId:
                        editReceipt.status === "returned"
                          ? editReceipt.id
                          : undefined,
                      replacesId: editReceipt.id,
                      void: editReceipt.amount_paise === 0,
                      version: editReceipt.version,
                    });
                    setEditReceipt(null);
                  } else if (refund) {
                    await api("/api/staff/finance", {
                      ...body,
                      action: "refund.create",
                    });
                  } else {
                    const form = new FormData();
                    form.set("details", JSON.stringify(body));
                    const file = f.get("file");
                    if (file instanceof File && file.size)
                      form.set("file", file);
                    const r = await fetch("/api/staff/finance/receipts", {
                        method: "POST",
                        body: form,
                      }),
                      result = await r.json();
                    if (!r.ok) throw Error(result.error);
                  }
                  setShowCollection(false);
                  setEditReceipt(null);
                });
              }}
            >
              <fieldset className={styles.collectionFields} disabled={busy}>
                {!editReceipt && (
                  <>
                    <label>
                      Entry type
                      <select
                        name="kind"
                        value={collectionKind}
                        onChange={(e) => {
                          setCollectionKind(e.target.value);
                          setCollectionParticipant("");
                        }}
                      >
                        <option value="receipt">Participant fee</option>
                        <option value="registered">
                          Registered participant fee
                        </option>
                        <option value="other">Other funds</option>
                        <option value="refund">Full refund already paid</option>
                      </select>
                    </label>
                    {(collectionKind === "registered" ||
                      collectionKind === "refund") && (
                      <label>
                        Participant
                        <select
                          name="registrationId"
                          aria-label="Participant"
                          required
                          value={collectionParticipant}
                          onChange={(e) =>
                            setCollectionParticipant(e.target.value)
                          }
                        >
                          <option value="">Select participant</option>
                          {formData?.registrations
                            .filter(
                              (r) =>
                                r.fee_paise > 0 &&
                                (collectionKind === "refund"
                                  ? r.payment_status === "paid"
                                  : r.status === "registered" &&
                                    ["pending", "failed"].includes(
                                      r.payment_status,
                                    ) &&
                                    !formData.entries.some(
                                      (e) =>
                                        e.registration_id === r.id &&
                                        e.kind === "receipt" &&
                                        e.status === "submitted",
                                    )),
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} · {rupees(r.fee_paise)} ·{" "}
                                {r.payment_status}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
                {((!editReceipt && collectionKind === "receipt") ||
                  editReceipt?.manual_participant_name) && (
                  <label>
                    Participant name
                    <input
                      name="participantName"
                      required
                      maxLength={160}
                      defaultValue={editReceipt?.manual_participant_name ?? ""}
                    />
                  </label>
                )}
                {(collectionKind === "other" ||
                  (editReceipt && !editReceipt.participant_name)) && (
                  <label>
                    Source of other funds
                    <input
                      name="label"
                      defaultValue={editReceipt?.label}
                      required={collectionKind === "other"}
                      maxLength={160}
                    />
                  </label>
                )}
                <label>
                  {collectionKind === "refund"
                    ? "Full refund amount (₹)"
                    : "Amount (₹)"}
                  <input
                    key={
                      editReceipt?.id ??
                      `${collectionKind}-${collectionParticipant}`
                    }
                    type="number"
                    name="amount"
                    required
                    min={
                      editReceipt?.amount_paise === 0 ||
                      collectionKind === "refund"
                        ? "0"
                        : "0.01"
                    }
                    step="0.01"
                    max="1000000"
                    readOnly={collectionKind === "refund" && !editReceipt}
                    defaultValue={
                      editReceipt
                        ? editReceipt.amount_paise / 100
                        : selectedRegistration
                          ? selectedRegistration.fee_paise / 100
                          : undefined
                    }
                  />
                </label>
                <label>
                  Transaction date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={
                      editReceipt
                        ? String(editReceipt.entry_date).slice(0, 10)
                        : undefined
                    }
                  />
                </label>
                <label>
                  Method
                  <input
                    name="method"
                    required
                    maxLength={80}
                    defaultValue={editReceipt?.method}
                  />
                </label>
                <label>
                  Reference
                  <input
                    name="reference"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={editReceipt?.reference}
                  />
                </label>
                <label>
                  Note / correction reason
                  <textarea
                    name="note"
                    required
                    minLength={3}
                    maxLength={1000}
                    defaultValue={editReceipt?.note}
                  />
                </label>
                {!editReceipt && (
                  <label>
                    Optional proof
                    <input
                      name="file"
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                    />
                  </label>
                )}
                <div className={styles.collectionActions}>
                  <button className="button">Submit to super admin</button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCollection(false);
                      setEditReceipt(null);
                    }}
                  >
                    Close collection form
                  </button>
                  {editReceipt && (
                    <button type="button" onClick={() => setEditReceipt(null)}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          </WorkspacePanel>
        )}

        {!fixedEventId && tab === "Overview" && data && (
          <section aria-labelledby="finance-events-title">
            <div className={styles.sectionHeading}>
              <h2 id="finance-events-title">Events</h2>
              <div className={styles.eventTools}>
                <input
                  type="search"
                  aria-label="Search events by name"
                  placeholder="Search events by name"
                  maxLength={160}
                  value={eventQuery}
                  onChange={(event) => setEventQuery(event.target.value)}
                />
                <details className={styles.eventMenu}>
                  <summary>
                    Filter{(eventMonths.length > 0 || eventYear) && " •"}
                  </summary>
                  <div className={styles.eventPopup}>
                    <fieldset className={styles.monthChoices}>
                      <legend>Months</legend>
                      {financeMonths.map((month) => (
                        <label key={month.value}>
                          <input
                            type="checkbox"
                            checked={eventMonths.includes(month.value)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setEventMonths((previous) =>
                                checked
                                  ? [...previous, month.value]
                                  : previous.filter(
                                      (value) => value !== month.value,
                                    ),
                              );
                            }}
                          />
                          {month.label}
                        </label>
                      ))}
                    </fieldset>
                    <label>
                      Year
                      <select
                        value={eventYear}
                        onChange={(event) => setEventYear(event.target.value)}
                      >
                        <option value="">All years</option>
                        {eventYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEventMonths([]);
                        setEventYear("");
                      }}
                    >
                      Clear date filters
                    </button>
                  </div>
                </details>
                <details className={styles.eventMenu}>
                  <summary
                    aria-label="Export filtered events"
                    title="Export filtered events"
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
                    </svg>
                  </summary>
                  <div className={styles.eventPopup}>
                    {["pdf", "xlsx"].map((format) => (
                      <button
                        key={format}
                        disabled={busy || !visibleEvents.length}
                        onClick={(event) => {
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                          void run(() =>
                            downloadReport(
                              format,
                              new URLSearchParams({
                                scope: "events",
                                ...eventFilters,
                                months: eventMonths.join(","),
                              }),
                            ),
                          );
                        }}
                      >
                        {format === "pdf" ? "Export PDF" : "Export Excel"}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <div
                className={`segmented ${styles.viewSwitch}`}
                role="group"
                aria-label="Event view"
              >
                <button
                  aria-pressed={eventView === "cards"}
                  onClick={() => setEventView("cards")}
                >
                  Card view
                </button>
                <button
                  aria-pressed={eventView === "list"}
                  onClick={() => setEventView("list")}
                >
                  List view
                </button>
              </div>
              <span>
                {visibleEvents.length}{" "}
                {visibleEvents.length === 1 ? "event" : "events"}
              </span>
            </div>
            {(eventMonths.length > 0 || eventYear) &&
              (() => {
                const eventIds = new Set(
                  visibleEvents.map((event) => event.id),
                );
                const totals = financeTotals(
                  data.entries.filter((entry) => eventIds.has(entry.event_id)),
                );
                return (
                  <p className={styles.basis}>
                    <strong>{financePeriodLabel(eventFilters)}</strong> ·
                    Collected {rupees(totals.received)} · Spent{" "}
                    {rupees(totals.expenses)} · {balanceLabel(totals.netResult)}
                  </p>
                );
              })()}
            {visibleEvents.length ? (
              eventView === "cards" ? (
                <div className={styles.eventGrid}>
                  {visibleEvents.map((e) => {
                    const totals = financeTotals(
                      data.entries.filter((r) => r.event_id === e.id),
                    );
                    return (
                      <Link
                        key={e.id}
                        href={`/admin/workspaces/payments/events/${e.id}`}
                        className={styles.eventCard}
                      >
                        <div className={styles.cardDate}>
                          {new Date(e.starts_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                          })}
                          <span>
                            {e.archived_at
                              ? "Archived"
                              : e.completed_at
                                ? "Completed"
                                : e.status === "draft"
                                  ? "Draft"
                                  : e.status === "cancelled"
                                    ? "Cancelled"
                                    : "Event"}
                          </span>
                        </div>
                        <h3>{e.title}</h3>
                        <p className={styles.cardMeta}>
                          {e.location || "Venue not specified"} ·{" "}
                          {e.participant_count}{" "}
                          {e.participant_count === 1
                            ? "participant"
                            : "participants"}
                        </p>
                        <dl className={styles.cardMoney}>
                          <div>
                            <dt>Total collected</dt>
                            <dd>{rupees(totals.received)}</dd>
                          </div>
                          <div>
                            <dt>Total spent</dt>
                            <dd>{rupees(totals.expenses)}</dd>
                          </div>
                        </dl>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Event finance list"
                >
                  <table className="operations-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Venue</th>
                        <th>Participants</th>
                        <th className={styles.number}>Total collected</th>
                        <th className={styles.number}>Total spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEvents.map((e) => {
                        const totals = financeTotals(
                          data.entries.filter((r) => r.event_id === e.id),
                        );
                        return (
                          <tr key={e.id}>
                            <td>
                              <Link
                                href={`/admin/workspaces/payments/events/${e.id}`}
                              >
                                {e.title}
                              </Link>
                            </td>
                            <td>
                              {new Date(e.starts_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "Asia/Kolkata",
                                },
                              )}
                            </td>
                            <td>{e.location || "Venue not specified"}</td>
                            <td>{e.participant_count}</td>
                            <td className={styles.number}>
                              {rupees(totals.received)}
                            </td>
                            <td className={styles.number}>
                              {rupees(totals.expenses)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <p>
                {data.events.length
                  ? "No events match your search and filters."
                  : "No events yet."}
              </p>
            )}
          </section>
        )}
        {fixedEventId && tab === "Participant collections" && data && (
          <>
            <WorkspacePanel title="Participant fee collections">
              <div className={styles.collectionSummary}>
                <span>Total collected from participants</span>
                <strong>
                  {rupees(
                    financeTotals(
                      receipts.filter(
                        (e) => e.registration_id || e.manual_participant_name,
                      ),
                    ).received,
                  )}
                </strong>
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Participant fee collections"
              >
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th className={styles.number}>Participation fee</th>
                      <th className={styles.number}>Collected</th>
                      <th className={styles.number}>Refunded</th>
                      <th>Status / pending approval</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registrations.map((r) => {
                      const totals = financeTotals(
                        receipts.filter((e) => e.registration_id === r.id),
                      );
                      return (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td className={styles.number}>
                            {moneyCell(r.fee_paise)}
                          </td>
                          <td className={styles.number}>
                            {moneyCell(totals.received)}
                          </td>
                          <td className={styles.number}>
                            {moneyCell(totals.refunded)}
                          </td>
                          <td>
                            {r.status === "cancelled"
                              ? "Registration cancelled"
                              : r.payment_status === "paid"
                                ? "Collected"
                                : r.payment_status === "not_required"
                                  ? "No fee required"
                                  : r.payment_status === "refunded"
                                    ? "Refunded"
                                    : "Awaiting collection"}
                            {totals.pendingReceipts > 0 && (
                              <small>
                                Awaiting approval:{" "}
                                {rupees(totals.pendingReceipts)}
                              </small>
                            )}
                          </td>
                          <td>
                            {writer &&
                              r.status === "registered" &&
                              r.fee_paise > 0 &&
                              ["pending", "failed"].includes(
                                r.payment_status,
                              ) &&
                              totals.pendingReceipts === 0 && (
                                <button onClick={() => openCollection(r.id)}>
                                  Add fee collection
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                    {receipts
                      .filter(
                        (e) =>
                          e.manual_participant_name &&
                          e.status !== "superseded",
                      )
                      .map((e) => (
                        <tr key={e.id}>
                          <td>{e.manual_participant_name}</td>
                          <td className={styles.number}>—</td>
                          <td className={styles.number}>
                            {moneyCell(
                              e.status === "approved" ? e.amount_paise : 0,
                            )}
                          </td>
                          <td className={styles.number}>—</td>
                          <td>
                            {e.status === "submitted"
                              ? `Awaiting approval: ${rupees(e.amount_paise)}`
                              : e.status === "approved"
                                ? "Collected"
                                : e.status}
                          </td>
                          <td>
                            <button onClick={() => openReview(e)}>
                              View receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>Total</th>
                      <td className={styles.number}>
                        {moneyCell(
                          financeTotals(
                            receipts.filter(
                              (e) =>
                                e.registration_id || e.manual_participant_name,
                            ),
                          ).received,
                        )}
                      </td>
                      <td className={styles.number}>
                        {moneyCell(
                          financeTotals(
                            receipts.filter(
                              (e) =>
                                e.registration_id || e.manual_participant_name,
                            ),
                          ).refunded,
                        )}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
                {!data.registrations.length &&
                  !receipts.some(
                    (e) =>
                      e.manual_participant_name && e.status !== "superseded",
                  ) && <p>No participants registered for this event yet.</p>}
              </div>
            </WorkspacePanel>
            <details>
              <summary>Collection history and corrections</summary>
              <WorkspacePanel title="Collection history">
                {receiptTable(receipts)}
              </WorkspacePanel>
            </details>
          </>
        )}
        {fixedEventId && tab === "Expenses" && data && (
          <WorkspacePanel>
            {!sheets.length && sheet === undefined && (
              <WorkspaceEmptyState
                icon="wallet"
                title="No expenses yet"
                description={
                  writer
                    ? "Add the first expense and submit it for super-admin approval."
                    : "Expense submissions will appear here once an admin adds them."
                }
                actionLabel={writer ? "Add first expense" : undefined}
                onAction={() => beginSheet()}
              />
            )}

            {sheets.some((s) => s.status === "superseded") && (
              <details>
                <summary>Previous expense sheets</summary>
                {sheets
                  .filter((s) => s.status === "superseded")
                  .map((s) => (
                    <p key={s.id}>
                      {s.label} · {rupees(s.amount_paise)}{" "}
                      <span className={styles.sheetStatus}>
                        {approvalStatus(s)}
                      </span>
                    </p>
                  ))}
              </details>
            )}
            {sheets
              .filter((s) => s.status !== "superseded")
              .map((s) => (
                <section key={s.id} className={styles.sheet}>
                  <div
                    className="table-scroll"
                    role="region"
                    tabIndex={0}
                    aria-label="Expense sheet lines"
                  >
                    <table className="operations-table">
                      <thead>
                        <tr>
                          <th>Header</th>
                          <th>Description / vendor</th>
                          <th>Date</th>
                          <th className={styles.number}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.lines.map((l, i) => (
                          <tr key={i}>
                            <td>{l.header}</td>
                            <td>
                              {l.description}
                              <small>
                                {l.vendor}
                                {l.note && ` · ${l.note}`}
                              </small>
                            </td>
                            <td>{l.date}</td>
                            <td className={styles.number}>
                              {moneyCell(l.amountPaise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th colSpan={3}>Total expenses</th>
                          <td className={styles.number}>
                            {moneyCell(s.amount_paise)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <span className={styles.sheetStatus}>
                    {approvalStatus(s)}
                  </span>
                  {writer &&
                    (s.status === "approved" ||
                      (["draft", "returned"].includes(s.status) &&
                        s.created_by === data?.actorId)) && (
                      <button onClick={() => beginSheet(s)}>
                        {s.status === "approved"
                          ? "Create revised sheet"
                          : "Continue sheet"}
                      </button>
                    )}
                </section>
              ))}
            {sheet !== undefined && writer && (
              <form
                className="member-settings"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    submit =
                      (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                        "value",
                      ) === "submit";
                  void run(async () => {
                    await api("/api/staff/finance", {
                      action: sheet ? "sheet.save" : "sheet.add",
                      id: crypto.randomUUID(),
                      eventId,
                      existingId:
                        sheet && ["draft", "returned"].includes(sheet.status)
                          ? sheet.id
                          : undefined,
                      version: sheet?.version,
                      replacesId:
                        sheet?.status === "approved"
                          ? sheet.id
                          : sheet?.replaces_id,
                      void: lines.length === 0 && !!sheet,
                      date: lines[0]?.date ?? emptyLine().date,
                      lines,
                      note: f.get("note"),
                      submit,
                    });
                    setSheet(undefined);
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <legend>
                    {sheet?.status === "approved"
                      ? "Revise approved sheet"
                      : "Draft expense sheet"}
                  </legend>
                  {lines.map((l, index) => (
                    <div key={index} className={styles.line}>
                      <strong>Line {index + 1}</strong>
                      {(
                        [
                          "header",
                          "description",
                          "date",
                          "amountPaise",
                          "vendor",
                          "note",
                        ] as const
                      ).map((key) => (
                        <label key={key}>
                          {
                            {
                              header: "Expense header",
                              description: "Description",
                              date: "Expense date",
                              amountPaise: "Amount (₹)",
                              vendor: "Vendor (optional)",
                              note: "Note (optional)",
                            }[key]
                          }
                          <input
                            type={
                              key === "date"
                                ? "date"
                                : key === "amountPaise"
                                  ? "number"
                                  : "text"
                            }
                            required={!["vendor", "note"].includes(key)}
                            min={key === "amountPaise" ? "0.01" : undefined}
                            step={key === "amountPaise" ? "0.01" : undefined}
                            maxLength={key === "amountPaise" ? undefined : 1000}
                            value={
                              key === "amountPaise"
                                ? l.amountPaise / 100 || ""
                                : l[key]
                            }
                            onChange={(e) =>
                              setLines(
                                lines.map((row, i) =>
                                  i !== index
                                    ? row
                                    : {
                                        ...row,
                                        [key]:
                                          key === "amountPaise"
                                            ? Math.round(
                                                Number(e.target.value) * 100,
                                              )
                                            : e.target.value,
                                      },
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines(lines.filter((_, i) => i !== index))
                        }
                      >
                        Remove line
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={lines.length >= 200}
                    onClick={() => setLines([...lines, emptyLine()])}
                  >
                    Add expense line
                  </button>
                  <p>
                    <strong>
                      Total:{" "}
                      {rupees(lines.reduce((n, l) => n + l.amountPaise, 0))}
                    </strong>
                  </p>
                  <label>
                    Sheet note / correction reason
                    <textarea
                      name="note"
                      maxLength={1000}
                      required={sheet?.status === "approved"}
                      minLength={sheet?.status === "approved" ? 3 : undefined}
                    />
                  </label>
                  <div className="action-row">
                    <button value="draft">Save draft</button>
                    <button className="button" value="submit">
                      Submit expenses for approval
                    </button>
                    <button type="button" onClick={() => setSheet(undefined)}>
                      Cancel edit
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </WorkspacePanel>
        )}
        {tab === "Approvals" && (
          <WorkspacePanel
            title={
              data?.reviewer
                ? "Super-admin approval queue"
                : "Member receipt verification"
            }
          >
            <p>
              {data?.reviewer
                ? "Review admin-created receipts, refunds, and complete expense sheets."
                : "Review the member’s payment proof before confirming receipt. No super-admin approval is needed."}
            </p>
            {submissions.length ? (
              <ul className={styles.submissions}>
                {[...pending, ...reviewed].map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={styles.submission}
                      aria-haspopup="dialog"
                      onClick={() => openReview(entry)}
                    >
                      <span>
                        <span className={styles.submissionHeading}>
                          <strong>{entry.event_title}</strong>
                          {Object.entries(submissionDates(entry)).map(
                            ([status, date]) =>
                              date && (
                                <span
                                  key={status}
                                  className={styles.submissionDate}
                                >
                                  {status === "submitted"
                                    ? "Submitted"
                                    : "Approved"}{" "}
                                  <time dateTime={date}>
                                    {approvalDateFormat.format(new Date(date))}
                                  </time>
                                </span>
                              ),
                          )}
                        </span>
                        <small>{entry.participant_name ?? entry.label}</small>
                      </span>
                      <span className={styles.amount}>
                        {rupees(entry.amount_paise)}
                      </span>
                      <span
                        className={styles.approvalStatus}
                        data-status={entry.status}
                      >
                        {approvalStatus(entry)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No submissions yet.</p>
            )}
          </WorkspacePanel>
        )}
        {review && (
          <dialog
            ref={reviewDialog}
            className={styles.reviewDialog}
            aria-labelledby={reviewHeadingId}
            onCancel={(event) => {
              event.preventDefault();
              setReview(null);
            }}
          >
            <header className={styles.reviewHeader}>
              <h2 id={reviewHeadingId} tabIndex={-1}>
                Submission details
              </h2>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setReview(null)}
              >
                ×
              </button>
            </header>
            <div className={styles.reviewSummary}>
              <div>
                <h3>{review.event_title}</h3>
                <p>{review.participant_name ?? review.label}</p>
              </div>
              <div className={styles.reviewAmount}>
                <strong>{rupees(review.amount_paise)}</strong>
                <span
                  className={styles.approvalStatus}
                  data-status={review.status}
                >
                  {approvalStatus(review)}
                </span>
              </div>
            </div>
            <dl className={styles.reviewFacts}>
              <div>
                <dt>Type</dt>
                <dd>
                  {review.kind === "expenses"
                    ? "Expense sheet"
                    : review.kind === "refund"
                      ? "Refund"
                      : "Receipt"}
                </dd>
              </div>
              <div>
                <dt>Transaction date</dt>
                <dd>{review.entry_date}</dd>
              </div>
              <div>
                <dt>Submitted by</dt>
                <dd>{review.creator_name}</dd>
              </div>
              {review.method && (
                <div>
                  <dt>Method</dt>
                  <dd>{review.method}</dd>
                </div>
              )}
              {review.reference && (
                <div>
                  <dt>Reference</dt>
                  <dd>{review.reference}</dd>
                </div>
              )}
            </dl>
            {review.note && (
              <div className={styles.reviewSection}>
                <h3>Submission note</h3>
                <p>{review.note}</p>
              </div>
            )}
            {review.lines.length > 0 && (
              <div className={styles.reviewSection}>
                <h3>Expense items</h3>
                <ul className={styles.reviewItems}>
                  {review.lines.map((line, index) => (
                    <li key={index}>
                      <span>
                        <strong>{line.header}</strong>
                        <small>
                          {line.description} · {line.date}
                        </small>
                      </span>
                      <span className={styles.amount}>
                        {rupees(line.amountPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {review.kind !== "expenses" && (
              <div className={styles.reviewSection}>
                <h3>Payment proof</h3>
                {review.proof_id ? (
                  <a
                    href={`/api/finance/proofs/${review.proof_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {review.proof_type?.startsWith("image/") && (
                      /* Private evidence must bypass public image optimization. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.proof}
                        src={`/api/finance/proofs/${review.proof_id}`}
                        alt="Submitted payment proof"
                      />
                    )}
                    Open payment proof
                  </a>
                ) : (
                  <p>No proof attached.</p>
                )}
              </div>
            )}
            {(review.history.length > 0 || review.review_note) && (
              <details className={styles.reviewSection}>
                <summary>Review history</summary>
                {review.review_note && (
                  <p>
                    {review.reviewer_name}: {review.review_note}
                  </p>
                )}
                <ol className={styles.reviewHistory}>
                  {review.history.map((item, index) => (
                    <li key={index}>
                      <strong>{item.action.replaceAll("_", " ")}</strong>
                      <small>
                        {item.actor} ·{" "}
                        {new Date(item.created_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </small>
                      {item.details.reason && <p>{item.details.reason}</p>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {review.status === "submitted" &&
              data &&
              review.created_by !== data.actorId &&
              (data.reviewer
                ? review.source !== "member"
                : review.source === "member") && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget),
                      action = (
                        e.nativeEvent as SubmitEvent
                      ).submitter?.getAttribute("value");
                    void run(async () => {
                      await api("/api/staff/finance", {
                        action,
                        eventId: review.event_id,
                        id: review.id,
                        version: review.version,
                        reason: f.get("reason"),
                      });
                      setReview(null);
                    });
                  }}
                >
                  <fieldset
                    className={styles.reviewDecision}
                    disabled={busy || reviewClosed}
                  >
                    <label>
                      Review reason
                      <textarea
                        name="reason"
                        required
                        minLength={3}
                        maxLength={1000}
                      />
                    </label>
                    <div className={styles.reviewActions}>
                      <button type="submit" className="button" value="approve">
                        {review.kind === "expenses"
                          ? "Approve expense sheet"
                          : review.kind === "refund"
                            ? "Approve refund"
                            : "Approve receipt"}
                      </button>
                      <button type="submit" value="return">
                        {review.source === "member"
                          ? "Reject with reason"
                          : "Return for correction"}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            {writer &&
              !reviewClosed &&
              review.status === "approved" &&
              !review.registration_id && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt(
                      "Reason for voiding this approved record",
                    );
                    if (!reason) return;
                    void run(async () => {
                      await api("/api/staff/finance", {
                        action:
                          review.kind === "expenses"
                            ? "sheet.save"
                            : "receipt.correct",
                        id: crypto.randomUUID(),
                        eventId: review.event_id,
                        replacesId: review.id,
                        void: true,
                        submit: true,
                        date: emptyLine().date,
                        lines: [],
                        amountPaise: 0,
                        label: review.label,
                        method: review.method || "Correction",
                        reference: review.reference || "Void correction",
                        note: reason,
                      });
                      setReview(null);
                    });
                  }}
                >
                  Submit void for super-admin approval
                </button>
              )}
            {message && <p role="status">{message}</p>}
          </dialog>
        )}
      </div>
    </div>
  );
}
