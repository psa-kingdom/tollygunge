"use client";
import { useState } from "react";
import { api } from "./operations-client";
type Editable = {
  person_id: string;
  person_version: number;
  membership_version: number;
  email: string;
  mobile: string;
  membership_number: string;
  type: string | null;
  status: string | null;
  person: {
    name: string;
    prefix?: string;
    firstName?: string;
    lastName?: string;
    organization?: string;
    jobTitle?: string;
    addresses?: unknown;
  };
};
export function MemberEditor({
  member,
  onSaved,
}: {
  member: Editable;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
      prefix: member.person.prefix || "",
      firstName: member.person.firstName || "",
      lastName: member.person.lastName || "",
      email: member.email,
      mobile: member.mobile || "",
      organization: member.person.organization || "",
      designation: member.person.jobTitle || "",
      membershipNumber: member.membership_number,
      addresses: member.person.addresses || {},
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <><a className="text-link" href={`/admin/workspaces/governance?id=${member.person_id}`}>Manage person and committee profile →</a>
    <details>
      <summary>Edit member contact and professional details</summary>
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/staff/members", {
              action: "update",
              personId: member.person_id,
              personVersion: member.person_version,
              membershipVersion: member.membership_version,
              member: form,
            });
            setMessage("Member details saved.");
            onSaved();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {(
          [
            "prefix",
            "firstName",
            "lastName",
            "email",
            "mobile",
            "organization",
            "designation",
            "membershipNumber",
          ] as const
        ).map((key) => (
          <label key={key}>
            {
              {
                prefix: "Prefix",
                firstName: "First name",
                lastName: "Last name",
                email: "Email",
                mobile: "Mobile",
                organization: "Organization",
                designation: "Designation",
                membershipNumber: "Membership number",
              }[key]
            }
            <input
              type={key === "email" ? "email" : "text"}
              required={["email", "membershipNumber"].includes(key)}
              maxLength={200}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <button className="button" disabled={busy}>
          Save member details
        </button>
        <p role="status">{message}</p>
      </form>
    </details></>
  );
}
