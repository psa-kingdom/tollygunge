"use client";
import { useState } from "react";
import { RegistrationPayments } from "./registration-payments";
import { PaymentDetailsManager } from "./payment-details";

const tabs = [
  { id: "registrations", label: "Registration payments" },
  { id: "instructions", label: "Payment instructions" },
];

export function PaymentsWorkspace() {
  const [tab, setTab] = useState(tabs[0].id);
  return <>
    <div role="tablist" aria-label="Payment tools" className="workspace-tabs">
      {tabs.map((item, index) => <button key={item.id} id={`payments-${item.id}-tab`} role="tab" aria-controls={`payments-${item.id}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs[1 - index];
        setTab(next.id);
        document.getElementById(`payments-${next.id}-tab`)?.focus();
      }}>{item.label}</button>)}
    </div>
    <div id="payments-registrations-panel" role="tabpanel" aria-labelledby="payments-registrations-tab" hidden={tab !== "registrations"}><RegistrationPayments /></div>
    <div id="payments-instructions-panel" role="tabpanel" aria-labelledby="payments-instructions-tab" hidden={tab !== "instructions"}><PaymentDetailsManager /></div>
  </>;
}
