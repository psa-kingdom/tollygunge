"use client";
import { useRef, useState } from "react";
import { inquiryTopics } from "@/domain/inquiries";
import { api } from "./operations-client";
import { useSearchParams } from "next/navigation";
import { IssueContext } from "./issue-context";
import { issueMessage, issuePrompt } from "@/domain/issue-report";
export function PublicInquiry({ source, compact = false }: { source: "homepage" | "contact"; compact?: boolean }) {
  const key = useRef<string | null>(null);
  const params = useSearchParams();
  const issueMode = source === "contact" && params.get("type") === "issue";
  const [diagnostics, setDiagnostics] = useState("");
  const [reference, setReference] = useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[saved,setSaved]=useState(false);
  const additional=<div className={compact ? "inquiry-additional-grid" : "form-grid"}>
    <label>Subject (optional)<input name="subject" minLength={3} maxLength={160} /></label>
    <label>Your role (optional)<input name="jobTitle" autoComplete="organization-title" maxLength={120} /></label>
    <label>City / locality (optional)<input name="location" autoComplete="address-level2" maxLength={120} /></label>
    <label>Preferred reply<select name="preference" defaultValue="email"><option value="email">Email</option><option value="phone">Phone (provide a number)</option></select></label>
  </div>;
  return <div className="inquiry-intake">
    {compact?<h3>Tell us what you have in mind.</h3>:<p>{issueMode ? "Report a website issue. Describe what you expected, what happened and how we can reproduce it. An authorized TPA team member will review your report." : "All fields are required unless marked optional."}</p>}
    {saved?<div className="notice" role="status"><strong>Your inquiry is saved.</strong><p>Reference: {reference}</p><p>The TPA team can now review it. Automated email and WhatsApp replies are not enabled yet.</p><button type="button" className="button secondary" onClick={()=>{setSaved(false);setMessage("");setDiagnostics("");key.current=null;}}>Send another inquiry</button></div>:
    <form key={issueMode ? "issue" : "inquiry"} className="member-settings public-inquiry" onInvalidCapture={event => { const details = (event.target as HTMLElement).closest("details"); if (details) details.open = true; }} onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage("");const data=new FormData(event.currentTarget);key.current??=crypto.randomUUID();
      try { const message = String(data.get("message") || ""); if (issueMode && message.trim() === issuePrompt.trim()) throw new Error("Describe the issue before sending your report."); const result = await api<{id:string}>("/api/inquiries", {...Object.fromEntries(data),message:issueMode ? issueMessage(message,diagnostics,!!diagnostics) : message,subject:String(data.get("subject")??"").trim()||`${data.get("topic")||"General"} inquiry`,consent:data.get("consent")==="on",source,submissionId:key.current});setReference(result.id);setSaved(true); }
      catch(error){setMessage(error instanceof Error?error.message:"Unable to save the inquiry. Please try again.");}finally{setBusy(false);}
    }}>
      <fieldset disabled={busy} className="inquiry-fields"><legend className="sr-only">Inquiry details</legend>
        <div className={compact ? "inquiry-basic-grid" : "form-grid"}>
          <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" spellCheck={false} required maxLength={254} /></label>
          <label>Phone number (optional)<input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
          <label>Organisation (optional)<input name="organization" autoComplete="organization" maxLength={160} /></label>
        </div>
        {compact?<fieldset className="inquiry-topics"><legend>Topic</legend><div>{inquiryTopics.map(topic=><label key={topic}><input type="radio" name="topic" value={topic} defaultChecked={topic==="General"}/><span>{topic}</span></label>)}</div></fieldset>:<label>Topic<select name="topic" defaultValue={issueMode ? "Website issue" : "General"}>{inquiryTopics.map(topic=><option key={topic}>{topic}</option>)}</select></label>}
        <label>{issueMode ? "Issue details" : "How can we help?"}<textarea name="message" required minLength={10} maxLength={issueMode ? 3500 : 4000} rows={issueMode ? 9 : 5} defaultValue={issueMode ? issuePrompt : ""} /></label>
        {issueMode && <IssueContext onChange={setDiagnostics} />}
        <details className="inquiry-additional"><summary>Additional details</summary><p>Optional details to help us route your inquiry.</p>{additional}</details>
        <div className="form-trap" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <p className="form-help">Please do not include passwords, identity documents or payment information.</p>
        <label className="consent-row"><input type="checkbox" name="consent" required /><span>I agree that TPA may store these details and contact me about this inquiry. This does not subscribe me to newsletters.</span></label>
        <button className="button" disabled={busy}>{busy?"Saving inquiry…":issueMode?"Send issue report":"Send inquiry"}</button>
      </fieldset><p role="status">{message}</p>
    </form>}
  </div>;
}
