import { instant } from "./operations";
export type HistoryRow = {
  line: number;
  email: string;
  eventId: string;
  attendedAt: string;
  errors: string[];
};
// RFC 4180 quoting, including quoted newlines; reject malformed CSV rather than guessing.
export function csvRows(source: string): string[][] {
  const rows: string[][] = [],
    row: string[] = [];
  let field = "",
    quoted = false,
    closed = false;
  const input = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      if (field || closed) throw new Error("Malformed CSV quotes.");
      quoted = true;
      continue;
    }
    if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (ch !== ",") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        if (row.some((cell) => cell !== "")) rows.push([...row]);
        row.length = 0;
      }
      continue;
    }
    if (closed) throw new Error("Unexpected text after a quoted CSV field.");
    field += ch;
  }
  if (quoted) throw new Error("CSV quote is not closed.");
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length > 501)
    throw new Error("Preview up to 500 history rows at a time.");
  return rows;
}
export function historyPreview(source: string): HistoryRow[] {
  const rows = csvRows(source);
  if (rows[0]?.join(",") !== "email,event_id,attended_at")
    throw new Error("Use the template headers: email,event_id,attended_at.");
  const seen = new Map<string, HistoryRow>();
  return rows.slice(1).map((cells, i) => {
    const row: HistoryRow = {
      line: i + 2,
      email: (cells[0] ?? "").trim().toLowerCase(),
      eventId: (cells[1] ?? "").trim().toLowerCase(),
      attendedAt: (cells[2] ?? "").trim(),
      errors: [],
    };
    if (cells.length !== 3) row.errors.push("Expected exactly three fields.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || row.email.length > 254)
      row.errors.push("Invalid email.");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        row.eventId,
      )
    )
      row.errors.push("Invalid event identifier.");
    try {
      if (instant(row.attendedAt) > new Date())
        throw new Error("Future timestamp");
    } catch {
      row.errors.push("Use a valid past ISO timestamp with timezone.");
    }
    const key = row.email + "|" + row.eventId,
      other = seen.get(key);
    if (other) {
      row.errors.push(`Duplicate of row ${other.line}.`);
      other.errors.push(`Duplicate of row ${row.line}.`);
    } else seen.set(key, row);
    return row;
  });
}
