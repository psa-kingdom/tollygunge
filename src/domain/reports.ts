import { hasPermission, type Permission } from "./access";
import { reportRange } from "./report-range";
export const reportDefinitions = {
  accounts: {
    label: "Account directory",
    permission: "members:review",
    meaning:
      "Accounts, not approved memberships. Accepted contact details only; dates refer to account creation.",
  },
  events: {
    label: "Events and attendance",
    permission: "events:manage",
    meaning:
      "Dates refer to event starts. Attendance is recorded check-ins, not accredited learning hours.",
  },
  inquiries: {
    label: "Inquiry summary",
    permission: "communications:manage",
    meaning:
      "Dates refer to inquiry receipt. Overdue follow-ups reflect the current state.",
  },
  content: {
    label: "Content totals",
    permission: "content:publish",
    meaning: "Current-state totals; date filters do not apply.",
  },
  newsletter: {
    label: "Newsletter totals",
    permission: "communications:manage",
    meaning: "Current consent totals; date filters do not apply.",
  },
} as const;
export type ReportName = keyof typeof reportDefinitions;
export const periods = [
  "all",
  "last30",
  "month",
  "previous",
  "financial",
  "custom",
] as const;
export type ReportFilters = {
  period: (typeof periods)[number];
  from: string | null;
  to: string | null;
  q: string;
  verification: string;
  review: string;
  contact: string;
};
export function permittedReports(roles: readonly string[]) {
  return (Object.keys(reportDefinitions) as ReportName[]).filter((name) =>
    hasPermission(roles, reportDefinitions[name].permission as Permission),
  );
}
export function reportName(value: unknown): ReportName {
  if (typeof value !== "string" || !Object.hasOwn(reportDefinitions, value))
    throw new Error("Choose an available report.");
  return value as ReportName;
}
export function directoryFilters(params: URLSearchParams) {
  const q = (params.get("q") || "").trim(),
    verification = params.get("verification") || "all",
    review = params.get("review") || "all",
    contact = params.get("contact") || "all";
  if (
    q.length > 120 ||
    !["all", "verified", "unverified"].includes(verification) ||
    !["all", "unverified", "pending", "verified", "rejected"].includes(
      review,
    ) ||
    !["all", "phone", "no-phone"].includes(contact)
  )
    throw new Error("Check the directory filters.");
  return { q, verification, review, contact };
}
export function reportFilters(params: URLSearchParams): ReportFilters {
  const period = params.get("period") || "custom";
  if (!periods.includes(period as (typeof periods)[number]))
    throw new Error("Choose a valid reporting period.");
  return {
    period: period as ReportFilters["period"],
    ...reportRange(params),
    ...directoryFilters(params),
  };
}
export function resolvePeriod(filters: ReportFilters, now = new Date()) {
  if (filters.period === "custom")
    return { from: filters.from, to: filters.to };
  if (filters.period === "all") return { from: null, to: null };
  const india = new Date(now.getTime() + 330 * 60000),
    y = india.getUTCFullYear(),
    m = india.getUTCMonth(),
    d = india.getUTCDate();
  const date = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  if (filters.period === "last30")
    return { from: date(y, m, d - 29), to: date(y, m, d) };
  if (filters.period === "month")
    return { from: date(y, m, 1), to: date(y, m + 1, 0) };
  if (filters.period === "previous")
    return { from: date(y, m - 1, 1), to: date(y, m, 0) };
  const startYear = m >= 3 ? y : y - 1;
  return { from: date(startYear, 3, 1), to: date(startYear + 1, 2, 31) };
}
export function csvText(value: unknown) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]|^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportLimit(count: number) {
  if (count > 10000)
    throw new Error(
      "More than 10,000 matching rows. Narrow the filters before exporting.",
    );
}
