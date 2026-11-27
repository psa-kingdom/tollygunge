export type CampaignAudience = {
  city: string;
  profession: string;
  source?: "members" | "public";
};
export type EmailTemplate = {
  id?: string;
  version: number;
  name: string;
  subject: string;
  body: string;
};
export type CampaignEntry = EmailTemplate & {
  audience: CampaignAudience;
  status: "draft" | "archived";
  updated_at?: string;
  dispatch_count?: number;
  all_cancelled?: boolean;
  last_sent_version?: number;
  recipient_count?: number;
  accepted_count?: number;
  queued_count?: number;
};
export const emptyCampaign: CampaignEntry = {
  version: 0,
  name: "",
  subject: "",
  body: "",
  audience: { city: "", profession: "" },
  status: "draft",
};
export function campaignState(
  entry: CampaignEntry,
): "Draft" | "Queued" | "Sent" | "Needs review" | "Cancelled" | "Archived" {
  if (entry.status === "archived") return "Archived";
  if (!entry.dispatch_count || entry.last_sent_version !== entry.version)
    return "Draft";
  if (entry.all_cancelled) return "Cancelled";
  if (entry.queued_count) return "Queued";
  return entry.accepted_count ? "Sent" : "Needs review";
}
export function audienceLabel(audience: CampaignAudience) {
  return audience.source === "public"
    ? "Newsletter subscribers"
    : "Website accounts";
}
export function emailLabel(value: string) {
  return (
    (
      {
        leased: "Processing",
        accepted: "Provider accepted",
        review: "Needs review",
        quota_wait: "Waiting for quota",
        queued: "Queued",
        failed: "Failed",
        delivered: "Delivered",
        not_recorded: "Not recorded",
        in_progress: "In progress",
        not_observed: "No delivery confirmation",
      } as Record<string, string>
    )[value] || value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase())
  );
}
export function canSaveCampaign(entry: CampaignEntry) {
  return (
    entry.name.trim().length >= 3 &&
    entry.name.length <= 100 &&
    entry.subject.trim().length >= 3 &&
    entry.subject.length <= 160 &&
    !/[\r\n]/.test(entry.subject) &&
    entry.body.trim().length >= 10 &&
    entry.body.length <= 6000
  );
}
