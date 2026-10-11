import { record, text } from "./operations";
export function campaignAudience(value: unknown) {
  const input = record(value);
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
