/** Calendar days are inclusive and interpreted in the association's timezone. */
export function validEventDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString().slice(0, 10) === value ? value : "";
}
export function eventInDateRange(date: string, from = "", to = "") {
  return !(from && to && from > to) && (!from || date >= from) && (!to || date <= to);
}
