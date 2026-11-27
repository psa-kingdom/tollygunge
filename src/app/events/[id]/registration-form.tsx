"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CopyValue } from "@/components/portal-values";
import { api } from "@/components/operations-client";
import { registrationFields } from "@/domain/event-registration-fields";
import { prefixes } from "@/domain/member-foundation";
import styles from "./registration.module.css";

const states = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "West Bengal", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "Other",
];

const fieldCopy: Record<string, [string, string]> = {
  firstName: ["First Name", "First name"],
  lastName: ["Last Name", "Last name"],
  mobile: ["Mobile", "10-digit mobile number"],
  organization: ["Organisation", "Firm / Company name"],
  jobTitle: ["Designation", "e.g. Partner, Associate"],
  address: ["Address", "Street, area"],
  city: ["City", "City / Town"],
  pin: ["PIN", "6-digit PIN code"],
};

type RegistrationResult = { payment_status: string; firstRegistration?: boolean; alreadyRegistered?: boolean };

export function EventRegistrationForm({ id, email, verified, profile, fee, studyCircle, freePlanName, upiAccounts }: {
  id: string;
  email?: string;
  verified: boolean;
  profile: Record<string, string>;
  fee: number;
  studyCircle: boolean;
  freePlanName: string;
  upiAccounts: { id: string; details: { upiId: string; payee: string; organiser: string } }[];
}) {
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<RegistrationResult>();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = "tpa-event-registration:" + id;
  const [lookupStatus, setLookupStatus] = useState("");
  const edited = useRef(new Set<string>());
  const contactEmail = email ?? draft.email ?? "";
  const booking = "/member/events?eventId=" + id;
  const payNow = draft.paymentMode === "Yes";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (saved && (!email || saved.email?.toLowerCase() === email.toLowerCase()))
          setDraft(saved);
      } catch {
        // Browser storage is optional.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [email, key]);

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return;
    let active = true;
    const timeout = setTimeout(async () => {
      setLookupStatus("Looking up your details…");
      try {
        const response = await api<{ found: boolean; details: Record<string,string> }>("/api/public/attendee", { email: contactEmail });
        if (!active) return;
        if (response.found) {
          setDraft(current => ({
            ...current,
            ...Object.fromEntries(Object.entries(response.details).filter(([name]) => !edited.current.has(name))),
          }));
        }
        setLookupStatus(response.found ? "Details found. Review and update them before registering." : "New to TPA? Complete your details below.");
      } catch {
        if (active) setLookupStatus("Details could not be loaded. You can fill in the form below.");
      }
    }, 350);
    return () => { active = false; clearTimeout(timeout); };
  }, [contactEmail]);

  function update(name: string, value: string) {
    if (name === "email") {
      edited.current.clear();
      setLookupStatus("");
      setDraft({ email: value });
      return;
    }
    edited.current.add(name);
    setDraft(current => ({ ...current, [name]: value }));
  }

  if (registration) return (
    <section className={styles.card}>
      <div className={`${styles["success-card"]} ${styles.confirmed}`}>
        <svg className={styles.flame} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C12 2 7 8 7 13a5 5 0 0 0 10 0c0-2-1-3-1-3s0 2-1.5 2S13 10 13 8c0 0 3 2 3 6a4 4 0 0 1-8 0c0-5 4-8 4-8z" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
        <h2>{registration.alreadyRegistered ? "Already Registered" : "Registration Received"}</h2>
        <p>Thank you for registering with the {studyCircle ? "Tollygunge CA CPE Study Circle" : "Tollygunge Professional Association"}.</p>
        <p>{registration.payment_status === "paid"
          ? "Your registration is marked paid. Check your email for the event details."
          : registration.payment_status === "not_required"
            ? "Your seat is confirmed. Check your email for the event details."
            : "Your registration is unpaid. You can pay later."}</p>
        {registration.firstRegistration && <p>Welcome to TPA! You are on our {freePlanName} membership plan. Check your welcome email for the invitation to set your password and complete your profile.</p>}
        <p><Link className={styles["booking-link"]} href={verified ? booking : "/login?returnTo=" + encodeURIComponent(booking)}>{verified ? "View your booking" : "Sign in to your member portal"}</Link></p>
      </div>
    </section>
  );

  function field(name: string) {
    const field = registrationFields.find(field => field.name === name)!;
    const [label, placeholder] = fieldCopy[name] ?? [field.label, ""];
    const value = draft[name] ?? profile[name] ?? (name === "state" ? "West Bengal" : "");
    const options = name === "prefix" ? (studyCircle ? ["Mr", "Ms", "Mrs"] : [...prefixes]) : name === "state" ? states : name === "country" ? ["India", "Other"] : null;
    const required = "required" in field || (studyCircle && ["prefix","lastName","city","state","country","pin"].includes(name));
    return (
      <div className={`${styles.field} ${name === "address" ? styles.full : ""}`} key={name}>
        <label htmlFor={name}>{label}{required && <span aria-hidden="true" className={styles.req}>*</span>}</label>
        {options ? (
          <select id={name} name={name} value={value} required={required} onChange={event => update(name, event.target.value)}>
            {name !== "country" && <option value="">Select</option>}
            {value && !options.includes(value) && <option>{value}</option>}
            {options.map(option => <option key={option} value={option}>{name === "prefix" && ["Mr","Ms","Mrs"].includes(option) ? option + "." : option}</option>)}
          </select>
        ) : (
          <input id={name} name={name} type={"type" in field ? field.type : "text"}
            autoComplete={field.autoComplete} required={required} placeholder={placeholder}
            value={value} onChange={event => update(name, event.target.value)}
            inputMode={name === "pin" ? "numeric" : undefined} maxLength={name === "pin" && studyCircle ? 6 : 160}
            pattern={name === "pin" && studyCircle ? "[0-9]{6}" : undefined} />
        )}
      </div>
    );
  }

  return (
    <section className={styles.card} id="registration">
      <div className={styles["card-inner"]}>
        <h2 className={styles["form-name"]}>{studyCircle ? "Registration for CPE Hours" : "Event Registration"}</h2>
        <form onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          if (payNow && !upiAccounts.length) return;
          const form = new FormData(event.currentTarget);
          const file = form.get("file");
          form.delete("file");
          form.delete("paymentMode");
          const input = {
            action: "register", email: contactEmail, eventId: id,
            details: Object.fromEntries(form), paymentMode: draft.paymentMode,
          };
          setBusy(true);
          setError("");
          try {
            const endpoint = verified ? "/api/member/events" : "/api/public/event-registration";
            const upload = new FormData();
            if (payNow) {
              upload.set("details", JSON.stringify(input));
              if (file instanceof File) upload.set("file", file);
            }
            const booking = await api<RegistrationResult>(endpoint, payNow ? upload : input);
            try { sessionStorage.removeItem(key); } catch {}
            setRegistration(booking);
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <p className={styles["section-label"]}>Email Address</p>
          <div className={styles.grid} style={{ marginBottom: 8 }}>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="contact-email">Email Address<span className={styles.req} aria-hidden="true">*</span>{!email && <span className={styles.hint}>enter your email address to auto-fill your details</span>}</label>
              <input id="contact-email" name="email" type="email" placeholder="you@example.com" required autoComplete="email"
                value={email ?? draft.email ?? ""} readOnly={Boolean(email)}
                onChange={event => update("email", event.target.value)} />
            </div>
          </div>
          <p className={styles["lookup-status"]} role="status">{lookupStatus}</p>

          <p className={styles["section-label"]}>Personal Details</p>
          <div className={`${styles.grid} ${styles.three}`} style={{ marginBottom: 18 }}>
            {["prefix", "firstName", "lastName"].map(field)}
          </div>
          <div className={styles.grid} style={{ marginBottom: 18 }}>
            {field("mobile")}
            <div className={styles.field}>
              <label htmlFor="personal-email">Email<span className={styles.req} aria-hidden="true">*</span></label>
              <input id="personal-email" type="email" placeholder="you@example.com" autoComplete="email"
                value={email ?? draft.email ?? ""} readOnly={Boolean(email)} onChange={event => update("email", event.target.value)} />
            </div>
          </div>
          <div className={styles.grid} style={{ marginBottom: 6 }}>{["organization", "jobTitle"].map(field)}</div>

          <p className={`${styles["section-label"]} ${styles.second}`}>Address</p>
          <div className={styles.grid} style={{ marginBottom: 18 }}>{field("address")}</div>
          <div className={styles.grid} style={{ marginBottom: 18 }}>{["city", "state"].map(field)}</div>
          <div className={styles.grid} style={{ marginBottom: 6 }}>{["country", "pin"].map(field)}</div>

          {fee > 0 && (
            <>
              <p className={`${styles["section-label"]} ${styles.second}`} id="payment-choice">Want to pay now</p>
              <div className={styles["payment-options"]} role="group" aria-labelledby="payment-choice">
                {["Yes", "No"].map(value => (
                  <label className={`${styles["payment-option"]} ${draft.paymentMode === value ? styles.checked : ""}`} key={value}>
                    <input type="radio" name="paymentMode" value={value} required checked={draft.paymentMode === value}
                      onChange={() => update("paymentMode", value)} />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              {payNow && (
                <section aria-label="UPI payment details" className={`${styles["payment-panel"]} ${styles.open}`}>
                  <p className={styles["payment-instructions"]}>Event fee <strong>₹{(fee / 100).toFixed(2)}</strong></p>
                  {upiAccounts.map(account => (
                    <div className={styles["upi-account"]} key={account.id}>
                      {account.details.organiser && <p><strong>{account.details.organiser}</strong></p>}
                      <p>UPI ID <CopyValue value={account.details.upiId} label="UPI ID" /></p>
                      {account.details.payee && <p>Payee {account.details.payee}</p>}
                    </div>
                  ))}
                  {upiAccounts.length > 0 ? (
                    <div className={styles.field}>
                      <label htmlFor="registration-proof">Payment proof (JPEG, PNG or PDF, up to 5 MB)</label>
                      <input id="registration-proof" name="file" type="file" accept="image/jpeg,image/png,application/pdf" required />
                    </div>
                  ) : <p>UPI payment is unavailable for this event. Choose No to register and pay later.</p>}
                </section>
              )}
            </>
          )}

          <div className={styles["submit-row"]}>
            {!email && <p className={styles["membership-note"]}>First-time attendees join the {freePlanName} membership plan and receive an invitation to set their password after registering.</p>}
            <button className={styles.submit} disabled={busy || (payNow && !upiAccounts.length)}>{busy ? "Registering…" : "Register"}</button>
            <p className={styles.status} role="status">{error}</p>
          </div>
        </form>
      </div>
    </section>
  );
}
