export type OperationalEvent = { status: string; starts_at: string; ends_at: string; registration_starts_at?: string | null; registration_ends_at?: string | null; booking_closed?: boolean; completed_at?: string | null; archived_at?: string | null };
export function eventStage(e: OperationalEvent, now = Date.now()) {
  if (e.archived_at) return 'Archived';
  if (e.completed_at) return 'Completed';
  if (e.status === 'cancelled') return 'Cancelled';
  if (e.status === 'draft') return 'Draft';
  if (new Date(e.ends_at).getTime() <= now) return 'Past';
  if (new Date(e.starts_at).getTime() <= now) return 'Live';
  if (e.booking_closed || (e.registration_ends_at && new Date(e.registration_ends_at).getTime() <= now)) return 'Registration closed';
  if (e.registration_starts_at && new Date(e.registration_starts_at).getTime() > now) return 'Scheduled';
  return 'Registration open';
}
export function moneyInput(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 100000000) throw Error('Enter an expense amount between ₹0.01 and ₹10,00,000.');
  return value;
}
export const expenseCategories = ['venue','catering','speaker','travel','accommodation','printing','marketing','equipment','miscellaneous'] as const;
export function recordingUrl(value: unknown) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS recording link without embedded credentials.');
  return url.href;
}
