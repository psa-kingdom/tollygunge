"use client";
import { useState } from "react";
type Application = {
  id: string;
  name: string;
  profession: string;
  plan: string;
  category: string;
  status: "Under review" | "Approved" | "Rejected";
  payment: "Paid";
};
const initial: Application[] = [
  {
    id: "PREVIEW-001",
    name: "Sample Applicant A",
    profession: "Chartered accountant",
    plan: "Annual",
    category: "Professional",
    status: "Under review",
    payment: "Paid",
  },
  {
    id: "PREVIEW-002",
    name: "Sample Applicant B",
    profession: "Commerce student",
    plan: "Annual",
    category: "Student",
    status: "Under review",
    payment: "Paid",
  },
  {
    id: "PREVIEW-003",
    name: "Sample Applicant C",
    profession: "Business advisor",
    plan: "Patron",
    category: "Professional",
    status: "Under review",
    payment: "Paid",
  },
];
export function ReviewWorkspace() {
  const [records, setRecords] = useState(initial);
  const [tab, setTab] = useState("Under review");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const application = records.find((r) => r.id === selected);
  const filtered = records.filter(
    (r) =>
      r.status === tab &&
      `${r.name} ${r.id} ${r.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function review(status: Application["status"]) {
    if (!application) return;
    if (status === "Rejected" && !reason.trim()) {
      setNotice("Enter a reason before rejecting this preview application.");
      return;
    }
    setRecords(records.map((r) => (r.id === selected ? { ...r, status } : r)));
    setNotice(
      status === "Rejected"
        ? "Preview application rejected. A staff-approved refund would be queued; no refund was issued."
        : "Preview application approved. No real membership number was generated.",
    );
    setSelected(null);
    setReason("");
  }
  return (
    <>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Application status"
      >
        {["Under review", "Approved", "Rejected"].map((t) => (
          <button
            role="tab"
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              const tabs = ["Under review", "Approved", "Rejected"];
              let index = tabs.indexOf(t);
              if (e.key === "ArrowRight") index = (index + 1) % 3;
              else if (e.key === "ArrowLeft") index = (index + 2) % 3;
              else if (e.key === "Home") index = 0;
              else if (e.key === "End") index = 2;
              else return;
              e.preventDefault();
              setTab(tabs[index]);
              setSelected(null);
              (
                e.currentTarget.parentElement?.children[
                  index
                ] as HTMLButtonElement
              )?.focus();
            }}
            aria-selected={tab === t}
            aria-controls="applications-panel"
            id={`tab-${t.replaceAll(" ", "-")}`}
            className={tab === t ? "selected" : ""}
            key={t}
            onClick={() => {
              setTab(t);
              setSelected(null);
            }}
          >
            {t} <span>({records.filter((r) => r.status === t).length})</span>
          </button>
        ))}
      </div>
      <div
        id="applications-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
      >
        <div className="review-toolbar">
          <span className="eyebrow">
            {filtered.length} APPLICATION{filtered.length === 1 ? "" : "S"}
          </span>
          <input
            aria-label="Search applications"
            placeholder="Search name, reference or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Membership</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>
                    <span className="eyebrow">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>
                        {r.profession} · {r.id}
                      </small>
                    </td>
                    <td>
                      {r.plan}
                      <small>{r.category}</small>
                    </td>
                    <td>
                      <span className="badge">{r.payment}</span>
                    </td>
                    <td>
                      <span className="badge pending">{r.status}</span>
                    </td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => {
                          setSelected(r.id);
                          setReason("");
                          setNotice("");
                        }}
                      >
                        View {r.status === "Under review" ? "& review" : ""} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No matching applications.</h3>
            <p>Try a different search or status.</p>
          </div>
        )}
        {application && (
          <section className="detail-panel" aria-label="Application detail">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{application.id}</span>
                <h2>{application.name}</h2>
              </div>
              <button className="link-button" onClick={() => setSelected(null)}>
                Close ×
              </button>
            </div>
            <p>
              {application.plan} · {application.category} · Payment recorded:{" "}
              {application.payment}
            </p>
            <div className="notice">
              Documents and payment evidence are illustrative only. Live review
              will require authenticated permissions and verified records.
            </div>
            {application.status === "Under review" && (
              <>
                <label className="field">
                  Review note / rejection reason
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button className="button" onClick={() => review("Approved")}>
                    Approve in preview →
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => review("Rejected")}
                  >
                    Reject in preview
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
