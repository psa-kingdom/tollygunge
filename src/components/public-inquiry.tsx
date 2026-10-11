"use client";
import { useRef, useState } from "react";
import { inquiryTopics } from "@/domain/inquiries";
import { api } from "./operations-client";
export function PublicInquiry({ source }: { source: "homepage" | "contact" }) {
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <div className="inquiry-intake">
      <p>
        Tell us what you have in mind. An authorized TPA team member can use
        these details to follow up. No account is required.
      </p>
      {saved ? (
        <div className="notice" role="status">
          <strong>Your inquiry is saved.</strong>
          <p>
            The TPA team can now review it. Automated email and WhatsApp replies
            are not enabled yet.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setSaved(false);
              setMessage("");
              key.current = null;
            }}
          >
            Send another inquiry
          </button>
        </div>
      ) : (
        <form
          className="member-settings public-inquiry"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage("");
            const data = new FormData(event.currentTarget);
            key.current ??= crypto.randomUUID();
            try {
              await api("/api/inquiries", {
                ...Object.fromEntries(data),
                consent: data.get("consent") === "on",
                source,
                submissionId: key.current,
              });
              setSaved(true);
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Unable to send. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
          onChange={() => {
            key.current = null;
          }}
        >
          <fieldset disabled={busy} className="plain-fieldset">
            <div className="form-grid">
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Phone number (optional)
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                />
              </label>
              <label>
                Organization / company (optional)
                <input
                  name="organization"
                  autoComplete="organization"
                  maxLength={160}
                />
              </label>
              <label>
                Your role (optional)
                <input
                  name="jobTitle"
                  autoComplete="organization-title"
                  maxLength={120}
                />
              </label>
              <label>
                City / locality (optional)
                <input
                  name="location"
                  autoComplete="address-level2"
                  maxLength={120}
                />
              </label>
              <label>
                Topic
                <select name="topic">
                  {inquiryTopics.map((topic) => (
                    <option key={topic}>{topic}</option>
                  ))}
                </select>
              </label>
              <label>
                Preferred reply
                <select name="preference">
                  <option value="email">Email</option>
                  <option value="phone">Phone (provide a number)</option>
                </select>
              </label>
            </div>
            <label>
              Subject
              <input name="subject" required minLength={3} maxLength={160} />
            </label>
            <label>
              How can we help?
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={4000}
                rows={5}
              />
            </label>
            <div className="form-trap" aria-hidden="true">
              <label>
                Leave this empty
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <p className="form-help">
              Please do not include passwords, government identity documents or
              payment information. Optional company details help us route your
              inquiry.
            </p>
            <label className="consent-row">
              <input type="checkbox" name="consent" required /> I agree that TPA
              may store these details and contact me about this inquiry. This
              does not subscribe me to campaigns.
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Saving inquiry…" : "Send inquiry"}
            </button>
          </fieldset>
          <p role="status">{message}</p>
        </form>
      )}
    </div>
  );
}
