/** Presentation of data already returned by the protected member events API. */
export type OverviewEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  completed_at?: string | null;
  archived_at?: string | null;
  registration_id: string | null;
  registration_status: string | null;
  payment_status: string;
  payment_reference?: string | null;
  fee_paise: number;
  registration_fee_paise?: number | null;
};
export function upcomingMemberEvents(events: OverviewEvent[], now: number) {
  return events
    .filter(
      (event) =>
        event.status === "published" &&
        !event.completed_at &&
        !event.archived_at &&
        Date.parse(event.ends_at) > now,
    )
    .sort(
      (a, b) =>
        Number(b.registration_status === "registered") -
          Number(a.registration_status === "registered") ||
        Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )
    .slice(0, 3);
}
export function overviewEventState(event: OverviewEvent) {
  if (!event.registration_id || event.registration_status !== "registered")
    return {
      label: "Upcoming event",
      tone: "neutral" as const,
      action: "View event",
    };
  const fee = event.registration_fee_paise ?? event.fee_paise;
  if (fee > 0 && event.payment_status === "failed")
    return {
      label: "Event payment needs attention",
      tone: "error" as const,
      action: "Review event payment",
    };
  if (fee > 0 && event.payment_status === "pending")
    return {
      label: event.payment_reference?.trim()
        ? "Event payment awaiting verification"
        : "Event payment reference needed",
      tone: "pending" as const,
      action: "Review event payment",
    };
  if (fee > 0 && event.payment_status !== "paid")
    return {
      label:
        event.payment_status === "refunded"
          ? "Event payment refunded"
          : event.payment_status === "cancelled"
            ? "Event payment cancelled"
            : "Event payment status unavailable",
      tone: "neutral" as const,
      action: "View registration",
    };
  return {
    label: "Registration confirmed",
    tone: "active" as const,
    action: "View registration",
  };
}
const activityLabels: Record<string, string> = {
  "application.draft_saved": "Application draft saved",
  "verification.submitted": "Profile submitted for review",
  "verification.approve": "Profile verification approved",
  "verification.corrections": "Profile corrections requested",
  "verification.reject": "Profile review declined",
  "verification.revoked": "Profile verification withdrawn",
  "person.save": "Person details saved",
  "person.submit": "Person details submitted for review",
  "person.approve": "Person details approved",
  "person.publish": "Person profile published",
  "identity.password_reset": "Account password reset",
  "registration.payment_cancelled": "Event payment cancelled",
};
export function portalActivityLabel(action: string) {
  return (
    activityLabels[action] ??
    action
      .replaceAll(/[._-]+/g, " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}
