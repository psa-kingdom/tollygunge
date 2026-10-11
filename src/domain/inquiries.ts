import { record, text, uuid } from "./operations";
export const inquiryStatuses = ["new", "contacted", "closed"] as const;
export const inquiryTopics = [
  "General",
  "Membership",
  "Events",
  "Partnership",
  "Professional collaboration",
] as const;
export function inquiryTags(value: unknown) {
  if (!Array.isArray(value) || value.length > 8)
    throw new Error("Use up to eight tags.");
  return [
    ...new Set(
      value.map((tag) => {
        const result = text(tag, "Tag", 30, 1).toLowerCase();
        if (!/^[a-z0-9][a-z0-9 -]*$/.test(result))
          throw new Error("Use letters, numbers, spaces or hyphens in tags.");
        return result;
      }),
    ),
  ];
}
export function publicInquiry(value: unknown) {
  const input = record(value);
  const email = text(input.email, "Email", 254, 3).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Provide a valid email address.");
  const phone = text(input.phone ?? "", "Phone", 30);
  if (phone && !/^\+?[0-9][0-9 ()-]{6,28}$/.test(phone))
    throw new Error("Check your phone number.");
  const topic = text(input.topic, "Topic", 50, 1);
  if (!(inquiryTopics as readonly string[]).includes(topic))
    throw new Error("Choose an inquiry topic.");
  const preference = text(input.preference, "Contact preference", 20, 1);
  if (
    !["email", "phone"].includes(preference) ||
    (preference === "phone" && !phone)
  )
    throw new Error("Provide a phone number for a phone reply.");
  if (input.consent !== true)
    throw new Error("Please agree to be contacted about this inquiry.");
  const source =
    input.source === "homepage"
      ? "homepage"
      : input.source === "contact"
        ? "contact"
        : null;
  if (!source) throw new Error("Invalid form source.");
  if (text(input.website ?? "", "Website", 200))
    throw new Error("Unable to submit this inquiry.");
  return {
    submissionId: uuid(input.submissionId),
    name: text(input.name, "Name", 120, 2),
    email,
    phone,
    organization: text(input.organization ?? "", "Organization", 160),
    jobTitle: text(input.jobTitle ?? "", "Role", 120),
    location: text(input.location ?? "", "City", 120),
    subject: text(input.subject, "Subject", 160, 3),
    message: text(input.message, "Message", 4000, 10),
    topic,
    preference,
    source,
  };
}
