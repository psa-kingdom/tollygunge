/** Read numeric hours while keeping older saved labels readable. */
export function cpeHoursInput(value: string | number | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = /^\+?((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s*(?:CPE\s*)?(?:hours?|hrs?))?$/i.exec(text);
  if (!match || !Number.isFinite(Number(match[1]))) return null;
  return String(Number(match[1]));
}

export function formatCpeHours(value: string | number | null | undefined): string {
  const hours = cpeHoursInput(value);
  if (hours === null) return String(value ?? "").trim();
  if (!hours) return "";
  return `${hours} CPE ${Number(hours) === 1 ? "hour" : "hours"}`;
}
