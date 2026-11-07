import { text } from "./operations";
export type FinanceLine = {
  header: string;
  description: string;
  date: string;
  amountPaise: number;
  vendor: string;
  note: string;
};
export function financeDate(value: unknown) {
  const s = text(value, "Transaction date", 10, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw Error("Choose a valid date.");
  return s;
}
export function financeAmount(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 100000000
  )
    throw Error("Enter an amount from ₹0.01 to ₹10,00,000.");
  return value;
}
export function expenseLines(value: unknown): FinanceLine[] {
  if (!Array.isArray(value) || !value.length || value.length > 200)
    throw Error("Add between 1 and 200 expense lines.");
  return value.map((v) => ({
    header: text(v.header, "Expense header", 160, 1),
    description: text(v.description, "Description", 1000, 1),
    date: financeDate(v.date),
    amountPaise: financeAmount(v.amountPaise),
    vendor: text(v.vendor ?? "", "Vendor", 160),
    note: text(v.note ?? "", "Note", 1000),
  }));
}
export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );
export function balanceLabel(value: number) {
  return value > 0
    ? `Surplus +${rupees(value)}`
    : value < 0
      ? `Deficit −${rupees(-value)}`
      : "Balanced ₹0";
}
export function financeTotals(
  rows: readonly {
    kind: string;
    status: string;
    amount_paise: number | string;
  }[],
) {
  const total = (kind: string, status = "approved") =>
    rows
      .filter((r) => r.kind === kind && r.status === status)
      .reduce((n, r) => n + Number(r.amount_paise), 0);
  const received = total("receipt"),
    refunded = total("refund"),
    expenses = total("expenses");
  return {
    received,
    refunded,
    expenses,
    netCollected: received - refunded,
    netResult: received - refunded - expenses,
    pendingReceipts: total("receipt", "submitted"),
    pendingExpenses: total("expenses", "submitted"),
  };
}

const eventDateParts = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
});

export function financeEventPeriod(date: string | Date) {
  const parts = eventDateParts.formatToParts(new Date(date));
  return {
    year: parts.find((part) => part.type === "year")?.value,
    month: parts.find((part) => part.type === "month")?.value,
  };
}

export const financeMonths = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, index, 1))),
}));

export type FinanceEventFilters = {
  q: string;
  year: string;
  months: readonly string[];
};

export function financePeriodLabel(filters: FinanceEventFilters) {
  const months = financeMonths
    .filter((month) => filters.months.includes(month.value))
    .map((month) => month.label);
  return `${months.length ? months.join(", ") : "All months"} · ${filters.year || "All years"}`;
}

export function matchesFinanceEvent(
  event: { title: string; starts_at: string | Date },
  filters: FinanceEventFilters,
) {
  if (!event.title.toLowerCase().includes(filters.q.trim().toLowerCase()))
    return false;
  if (!filters.year && !filters.months.length) return true;
  const period = financeEventPeriod(event.starts_at);
  return (
    (!filters.year || period.year === filters.year) &&
    (!filters.months.length || filters.months.includes(period.month ?? ""))
  );
}
