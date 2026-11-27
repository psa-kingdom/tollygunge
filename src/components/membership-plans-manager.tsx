"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./operations-client";
import { MembershipPlanCard } from "./membership-plan-card";
import {
  planGst,
  planTotal,
  type MembershipPlanDetails,
} from "@/domain/membership-plans";
import { rupees } from "@/domain/finance";
import styles from "./membership-plans-manager.module.css";

function PlanEditor({
  initial,
  close,
  saved,
}: {
  initial: MembershipPlanDetails;
  close: () => void;
  saved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cost, setCost] = useState(
    ((initial?.cost_paise ?? 0) / 100).toFixed(2),
  );
  const [gst, setGst] = useState(
    String((initial?.gst_basis_points ?? 0) / 100),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const preview = {
    cost_paise: Math.round(Number(cost || 0) * 100),
    gst_basis_points: Math.round(Number(gst || 0) * 100),
  };
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Edit membership plan"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <div className={styles.bar}>
        <h2>Edit plan</h2>
        <button
          type="button"
          disabled={busy}
          onClick={close}
          aria-label="Close plan editor"
        >
          ×
        </button>
      </div>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          const values = Object.fromEntries(new FormData(event.currentTarget));
          try {
            await api("/api/staff/membership-plans", {
              ...values,
              cost,
              gst,
              action: "save",
              code: initial?.code,
              version: initial?.version,
            });
            saved();
            close();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Plan name
            <input
              name="name"
              defaultValue={initial?.name}
              required
              maxLength={80}
              autoFocus
            />
          </label>
          <div className={styles.twoColumns}>
            <label>
              Base cost (₹)
              <input
                type="number"
                min="0"
                max="9999999.99"
                step="0.01"
                required
                readOnly={initial?.code === "Free"}
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </label>
            <label>
              GST (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                readOnly={initial?.code === "Free"}
                value={gst}
                onChange={(event) => setGst(event.target.value)}
              />
            </label>
          </div>
          <dl className={styles.total}>
            <div>
              <dt>GST amount</dt>
              <dd>{rupees(planGst(preview))}</dd>
            </div>
            <div>
              <dt>Total cost</dt>
              <dd>{rupees(planTotal(preview))}</dd>
            </div>
          </dl>
          <label>
            Plan benefits
            <textarea
              name="benefits"
              defaultValue={initial?.benefits}
              maxLength={6000}
              rows={4}
            />
          </label>
          {initial?.code === "Free" && (
            <p className={styles.help}>
              New event attendees are assigned to this plan.
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save plan"}
          </button>
          {message && <p role="alert">{message}</p>}
        </fieldset>
      </form>
    </dialog>
  );
}

export function MembershipPlansManager() {
  const [plans, setPlans] = useState<MembershipPlanDetails[]>();
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<MembershipPlanDetails>();

  useEffect(() => {
    let active = true;
    api<{ plans: MembershipPlanDetails[] }>("/api/staff/membership-plans")
      .then((result) => {
        if (active) {
          setPlans(result.plans);
          setError("");
        }
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const reload = () => setRetry((value) => value + 1);
  return (
    <section className={styles.workspace} aria-label="Membership plans">
      <div className={styles.heading}>
        <h2>Membership plans</h2>
      </div>
      {error && (
        <p role="alert">
          {error} <button onClick={reload}>Retry</button>
        </p>
      )}
      {!plans && !error && <p role="status">Loading plans…</p>}
      <div className={styles.cards}>
        {plans?.map((plan) => (
          <MembershipPlanCard
            key={plan.code}
            name={plan.name}
            plan={plan}
            actions={
              <button
                className="button secondary"
                onClick={() => setEditor(plan)}
              >
                Edit plan
              </button>
            }
          />
        ))}
      </div>
      {editor && (
        <PlanEditor
          initial={editor}
          close={() => setEditor(undefined)}
          saved={reload}
        />
      )}
    </section>
  );
}
