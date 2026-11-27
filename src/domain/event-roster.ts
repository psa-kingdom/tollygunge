export type RosterRow = {
  id: string;
  name: string;
  email: string;
  number: string;
  phone: string;
  organisation: string;
  plan: string;
  registrationStatus: string;
  attendance: "Attended" | "Not attended" | "Not recorded";
  source: "platform" | "historical" | "imported";
  live?: {
    id: string;
    status: string;
    payment_status: string;
    fee_paise: number;
    registered_at: string;
    checked_in_at: string | null;
    outcome: string;
    version: number;
    registration_details?: Record<string, string>;
    payment_method?: string;
    payment_reference?: string;
    payment_note?: string;
    payment_proof_id?: string;
    receipt_source?: string;
  };
};
export function rosterIdentity(
  row: Pick<RosterRow, "email" | "number" | "phone" | "name">,
) {
  if (row.email) return "email:" + row.email.trim().toLowerCase();
  if (row.number) return "number:" + row.number.trim().replace(/^0+(?=\d)/, "");
  if (row.phone) return "phone:" + row.phone.replace(/\D/g, "").slice(-10);
  return "name:" + row.name.trim().toLowerCase();
}
export function rosterMatches(
  a: Pick<RosterRow, "email" | "number" | "phone" | "name">,
  b: Pick<RosterRow, "email" | "number" | "phone" | "name">,
) {
  return Boolean(
    (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) ||
    (a.number &&
      b.number &&
      a.number.replace(/^0+(?=\d)/, "") ===
        b.number.replace(/^0+(?=\d)/, "")) ||
    (a.phone &&
      b.phone &&
      a.phone.replace(/\D/g, "").slice(-10) ===
        b.phone.replace(/\D/g, "").slice(-10)),
  );
}
