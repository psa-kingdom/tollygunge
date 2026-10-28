"use client";
import { useState } from "react";
import { issueDiagnostics } from "@/domain/issue-report";
import { useSearchParams } from "next/navigation";

export function IssueContext({ onChange }: { onChange: (value: string) => void }) {
  const [preview, setPreview] = useState("");
  const [included, setIncluded] = useState(false);
  const params = useSearchParams();
  return <fieldset className="issue-context">
    <legend>Optional technical context</legend>
    <p>Preview the version, page, browser family and screen size before including them. No query strings, record IDs or form contents are collected.</p>
    <button className="button secondary" type="button" onClick={() => {
      const value = issueDiagnostics(params.get("from") || location.pathname, navigator.userAgent, innerWidth, innerHeight);
      setPreview(value); setIncluded(false); onChange("");
    }}>Preview technical context</button>
    {preview && <><pre className="issue-context-preview">{preview}</pre><label><input type="checkbox" checked={included} onChange={event => { setIncluded(event.target.checked); onChange(event.target.checked ? preview : ""); }} />Include this technical context with my report</label></>}
  </fieldset>;
}
