export type Speaker = { name: string; credentials: string; designation?: string; organization?: string; description?: string };
export type ReminderSettings = { enabled: boolean; offsets: number[]; includePending: boolean };
export const defaultReminders: ReminderSettings = { enabled: true, offsets: [1440, 60], includePending: false };
export const disabledReminders: ReminderSettings = { ...defaultReminders, enabled: false };
export function speakersInput(value: unknown): Speaker[] {
  if (!Array.isArray(value) || value.length > 6) throw Error("Choose up to six speakers.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw Error("Check the speaker details.");
    const { name, credentials = "" } = entry;
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60 || typeof credentials !== "string" || credentials.trim().length > 120)
      throw Error("Speaker names need 2–60 characters; credentials allow 120.");
    const extra: Pick<Speaker,'designation'|'organization'|'description'> = {};
    for(const [key,max] of [['designation',120],['organization',160],['description',500]] as const) {
      const value = (entry as Record<string, unknown>)[key] ?? '';
      if(typeof value !== 'string' || value.length>max || /[\u0000-\u001f]/.test(value)) throw Error('Check speaker professional details.');
      // Optional fields preserve the old wire shape when omitted.
      if(key in entry) extra[key]=value.trim();
    }
    return { name: name.trim(), credentials: credentials.trim(), ...extra };
  });
}
export function remindersInput(value: unknown): ReminderSettings {
  if (!value || typeof value !== "object") throw Error("Check reminder settings.");
  const { enabled, offsets, includePending } = value as ReminderSettings;
  if (typeof enabled !== "boolean" || typeof includePending !== "boolean" || !Array.isArray(offsets) || offsets.length < 1 || offsets.length > 3 || new Set(offsets).size !== offsets.length || offsets.some((n) => !Number.isInteger(n) || n < 15 || n > 10080))
    throw Error("Choose one to three different reminder times, 15 minutes to seven days before starting.");
  return { enabled, offsets: [...offsets].sort((a, b) => b - a), includePending };
}
export const eventTime = (value: string | Date) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
export const istInput = (value: string) => new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 16);
export const istInstant = (value: string) => new Date(value + ":00+05:30").toISOString();
export function eventLink(origin: string, event: { id: string; visibility: string }) {
  return `${origin}${event.visibility === "members" ? "/member/events?eventId=" : "/events/"}${event.id}`;
}
export function bookingLabel(event: { starts_at: string; registration_starts_at?: string | null; registration_ends_at?: string | null; status?:string; booking_closed?:boolean; completed_at?:unknown; archived_at?:unknown }, now = Date.now()) {
  if (event.status === "cancelled" || event.status === "draft" || event.booking_closed || event.completed_at || event.archived_at || new Date(event.starts_at).getTime() <= now || (event.registration_ends_at && new Date(event.registration_ends_at).getTime() <= now)) return "Registration closed";
  if (event.registration_starts_at && new Date(event.registration_starts_at).getTime() > now) return "Registration opens " + eventTime(event.registration_starts_at);
  return "Registration open";
}
// Event continuation is deliberately restricted to the member event route.
export function eventReturnPath(value: unknown): string | undefined {
  return typeof value === "string" && /^\/member\/events(?:\?eventId=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?$/i.test(value) ? value : undefined;
}
