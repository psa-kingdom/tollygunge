"use client";
import { useState } from "react";
const steps = [
  "Your membership",
  "Basic details",
  "Contact details",
  "Verification",
  "Review & payment",
];
export function ApplicationForm() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    plan: "Annual",
    category: "Professional",
  });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  function field(name: string, label: string, type = "text", required = true) {
    return (
      <label className="field" key={name}>
        {label}
        {required ? " *" : ""}
        <input
          name={name}
          type={type}
          required={required}
          value={values[name] ?? ""}
          onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        />
      </label>
    );
  }
  return (
    <div className="form-layout">
      <aside>
        <ol className="step-list" aria-label="Application steps">
          {steps.map((s, i) => (
            <li
              className={step === i ? "active" : ""}
              aria-current={step === i ? "step" : undefined}
              key={s}
            >
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p style={{ fontSize: 12 }}>
          Payment is followed by association review. Membership starts only
          after approval.
        </p>
      </aside>
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (step < 4) setStep(step + 1);
          else setComplete(true);
        }}
      >
        <span className="eyebrow">STEP {step + 1} OF 5</span>
        <h2 style={{ marginTop: 12 }}>{steps[step]}</h2>
        {step === 0 && (
          <>
            <p>Choose how you’d like to be part of the community.</p>
            <div className="form-grid">
              <label className="field">
                Membership plan
                <select
                  value={values.plan}
                  onChange={(e) =>
                    setValues({ ...values, plan: e.target.value })
                  }
                >
                  {["Annual", "Life", "Patron"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Applicant category
                <select
                  value={values.category}
                  onChange={(e) =>
                    setValues({ ...values, category: e.target.value })
                  }
                >
                  <option>Professional</option>
                  <option>Student</option>
                </select>
              </label>
            </div>
            <div className="notice">
              Fees, benefits and eligibility are awaiting association
              confirmation. No payment is collected in this preview.
            </div>
          </>
        )}
        {step === 1 && (
          <div className="form-grid">
            {field("name", "Full name")}
            {field(
              "profession",
              values.category === "Student"
                ? "Course / discipline"
                : "Profession",
            )}
            {field("qualification", "Qualification")}
            {field(
              "registration",
              "Professional registration number",
              "text",
              values.category !== "Student",
            )}
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            {field("email", "Email", "email")}
            {field("mobile", "Mobile number", "tel")}
            {field(
              "firm",
              values.category === "Student" ? "Institution" : "Office / firm",
              "text",
              false,
            )}
            {field("address", "Address")}
            <label className="field wide">
              Professional interests
              <textarea
                value={values.interests ?? ""}
                onChange={(e) =>
                  setValues({ ...values, interests: e.target.value })
                }
              />
            </label>
          </div>
        )}
        {step === 3 && (
          <>
            <p>
              We’ll ask for a professional certificate (or student eligibility
              evidence) and a photograph when applications open.
            </p>
            <div className="notice">
              Uploads are unavailable until private storage and authenticated
              access are configured. Please do not provide documents in this
              preview.
            </div>
            <label className="checkbox-field">
              <input type="checkbox" required />I understand that evidence will
              be required for association review.
            </label>
          </>
        )}
        {step === 4 && (
          <>
            <ul className="review-list">
              <li>
                <strong>
                  {values.plan} membership · {values.category}
                </strong>
                Fee awaiting confirmation
              </li>
              <li>
                <strong>{values.name}</strong>
                {values.profession} · {values.qualification}
              </li>
              <li>
                <strong>Contact</strong>
                {values.email}
                <br />
                {values.mobile}
              </li>
            </ul>
            <p style={{ fontSize: 12 }}>
              When applications open: payment → association review → approval →
              membership number. Rejected paid applications enter a
              staff-approved refund workflow.
            </p>
            <label className="checkbox-field">
              <input type="checkbox" required />I understand this is a preview
              and does not submit an application.
            </label>
            {complete && (
              <div role="status" className="notice">
                Preview complete. Nothing was submitted or stored. You can
                revisit earlier steps to refine your details.
              </div>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 0 ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setStep(step - 1);
                setComplete(false);
              }}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="button" type="submit">
            {step === 4 ? "Complete preview" : "Continue"} <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
