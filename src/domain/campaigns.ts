import { record, text } from "./operations";
export function campaignAudience(value: unknown) {
  const input = record(value);
  if (input.source !== undefined && !["members", "public"].includes(String(input.source))) throw new Error("Choose a valid audience source.");
  if (input.source === "public") {
    if (input.city || input.profession) throw new Error("Public subscribers are selected by newsletter consent, without member profile filters.");
    return { city: "", profession: "", source: "public" as const };
  }
  return {
    city: text(input.city ?? "", "City", 120),
    profession: text(input.profession ?? "", "Profession", 120),
  };
}
export function campaignDetails(value: unknown) {
  const input = record(value);
  const subject = text(input.subject, "Subject", 160, 3);
  if (/[\r\n]/.test(subject)) throw new Error("Keep the subject on one line.");
  return {
    name: text(input.name, "Campaign name", 100, 3),
    subject,
    body: text(input.body, "Message", 6000, 10),
    audience: campaignAudience(input.audience),
  };
}
