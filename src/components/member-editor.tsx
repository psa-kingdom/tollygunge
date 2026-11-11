"use client";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "./operations-client";
import { prefixes } from "@/domain/member-foundation";

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

export function MemberCreator({
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  onSaved: (personId: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState({
    prefix: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    organization: "",
    designation: "",
    membershipNumber: "",
    type: "Life",
    status: "active",
    provisionAccount: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
    onDirtyChange?.(true);
  }

  return (
    <form
      className="member-settings"
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        setFieldErrors({});
        try {
          const res = await api<{
            result: {
              personId: string;
              status: "created" | "updated";
              accountId?: string;
              invitationQueued?: boolean;
              warnings: string[];
            };
          }>("/api/staff/members", {
            action: "create",
            member: {
              prefix: form.prefix || undefined,
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              email: form.email.trim(),
              mobile: form.mobile.trim() || undefined,
              organization: form.organization.trim() || undefined,
              designation: form.designation.trim() || undefined,
              membershipNumber: form.membershipNumber.trim(),
            },
            membership: {
              type: form.type,
              status: form.status,
            },
            provisionAccount: form.provisionAccount,
          });
          onDirtyChange?.(false);
          onSaved(res.result.personId);
        } catch (err) {
          if (err instanceof ApiError) {
            setMessage(err.message);
            if (err.fieldErrors) {
              setFieldErrors(err.fieldErrors);
            }
          } else {
            setMessage((err as Error).message || "Unable to create member.");
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Prefix
        <select
          value={form.prefix}
          onChange={(e) => updateField("prefix", e.target.value)}
        >
          <option value="">None</option>
          {prefixes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {fieldErrors.prefix && (
          <span className="field-error" role="alert">
            {fieldErrors.prefix}
          </span>
        )}
      </label>

      <label>
        First name *
        <input
          type="text"
          required
          maxLength={120}
          value={form.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
        />
        {fieldErrors.firstName && (
          <span className="field-error" role="alert">
            {fieldErrors.firstName}
          </span>
        )}
      </label>

      <label>
        Last name *
        <input
          type="text"
          required
          maxLength={120}
          value={form.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
        />
        {fieldErrors.lastName && (
          <span className="field-error" role="alert">
            {fieldErrors.lastName}
          </span>
        )}
      </label>

      <label>
        Email *
        <input
          type="email"
          required
          maxLength={254}
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
        />
        {fieldErrors.email && (
          <span className="field-error" role="alert">
            {fieldErrors.email}
          </span>
        )}
      </label>

      <label>
        Mobile
        <input
          type="tel"
          maxLength={32}
          placeholder="e.g. +91 98765 43210"
          value={form.mobile}
          onChange={(e) => updateField("mobile", e.target.value)}
        />
        {fieldErrors.mobile && (
          <span className="field-error" role="alert">
            {fieldErrors.mobile}
          </span>
        )}
      </label>

      <label>
        Organization
        <input
          type="text"
          maxLength={200}
          value={form.organization}
          onChange={(e) => updateField("organization", e.target.value)}
        />
        {fieldErrors.organization && (
          <span className="field-error" role="alert">
            {fieldErrors.organization}
          </span>
        )}
      </label>

      <label>
        Designation
        <input
          type="text"
          maxLength={120}
          value={form.designation}
          onChange={(e) => updateField("designation", e.target.value)}
        />
        {fieldErrors.designation && (
          <span className="field-error" role="alert">
            {fieldErrors.designation}
          </span>
        )}
      </label>

      <label>
        Membership number *
        <input
          type="text"
          required
          maxLength={80}
          placeholder="e.g. M-1042"
          value={form.membershipNumber}
          onChange={(e) => updateField("membershipNumber", e.target.value)}
        />
        {fieldErrors.membershipNumber && (
          <span className="field-error" role="alert">
            {fieldErrors.membershipNumber}
          </span>
        )}
      </label>

      <label>
        Membership plan
        <select
          value={form.type}
          onChange={(e) => updateField("type", e.target.value)}
        >

          {form.type === "Annual" && <option value="Annual" disabled>Historical Annual membership — select Life or Patron to change</option>}
          <option value="Life">Life member</option>
          <option value="Patron">Patron member</option>
        </select>
        {fieldErrors.type && (
          <span className="field-error" role="alert">
            {fieldErrors.type}
          </span>
        )}
      </label>

      <label>
        Membership status
        <select
          value={form.status}
          onChange={(e) => updateField("status", e.target.value)}
        >
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="resigned">Resigned</option>
        </select>
        {fieldErrors.status && (
          <span className="field-error" role="alert">
            {fieldErrors.status}
          </span>
        )}
      </label>

      <label className="check-label consent">
        <input
          type="checkbox"
          checked={form.provisionAccount}
          onChange={(e) => updateField("provisionAccount", e.target.checked)}
        />
        <span>Provision user account and prepare onboarding invitation</span>
      </label>

      <div className="action-row">
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Creating member…" : "Create member"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {message && (
        <p role="status" className="field-error">
          {message}
        </p>
      )}
    </form>
  );
}

export function MemberEditor({
  member,
  onSaved,
  onDirtyChange,
}: {
  member: Editable;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
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
      type: member.type || "Life",
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <><a className="text-link" href={`/admin/workspaces/governance?id=${member.person_id}`}>Manage person and committee profile →</a>
    <details>
      <summary>Edit member contact and professional details</summary>
      <form
        className="member-settings"
        onChange={() => onDirtyChange?.(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const { type, ...memberData } = form;
            await api("/api/staff/members", {
              action: "update",
              personId: member.person_id,
              personVersion: member.person_version,
              membershipVersion: member.membership_version,
              member: memberData,
              membership: { type },
            });
            setMessage("Member details saved.");
            onDirtyChange?.(false);
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
        <label>
          Member type
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >

            {form.type === "Annual" && <option value="Annual" disabled>Historical Annual membership — select Life or Patron to change</option>}
          <option value="Life">Life member</option>
            <option value="Patron">Patron member</option>
          </select>
        </label>
        <button className="button" disabled={busy}>
          Save member details
        </button>
        <p role="status">{message}</p>
      </form>
    </details></>
  );
}
