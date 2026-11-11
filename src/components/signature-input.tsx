"use client";
import { useRef, useState } from "react";
import { initialFields } from "@/domain/verification";
import { DocumentPreview } from "./document-preview";
export function SignatureInput({ value, onUpload, details }: { value?: string; onUpload: (file: File) => Promise<void>; details: Record<string, string> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [ink, setInk] = useState(false);
  const [saving, setSaving] = useState(false);
  async function download() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(18); pdf.text("TPA membership declaration", 20, 24);
    pdf.setFontSize(11);
    let y = 40;
    for (const field of initialFields.filter(f => f.visible && f.type !== "document" && f.type !== "checkbox" && details[f.id])) {
      const lines: string[] = pdf.splitTextToSize(`${field.label}: ${details[field.id]}`, 170);
      for (const line of lines) { if (y > 260) { pdf.addPage(); y = 24; } pdf.text(line, 20, y); y += 6; }
      y += 4;
    }
    if (y > 200) { pdf.addPage(); y = 24; }
    pdf.text(pdf.splitTextToSize("I confirm that my membership application details are correct and submit them for TPA review.", 170), 20, y + 10);
    pdf.text("Applicant signature: __________________________", 20, y + 45);
    pdf.text("Date: __________________  Place: __________________", 20, y + 65);
    pdf.save("tpa-membership-declaration.pdf");
  }
  return <section className="signature-field form-span" aria-label="Applicant signature">
    <h3>Applicant signature *</h3>
    <p>Draw with your cursor or finger, then save. Alternatively, download the declaration, sign it and upload it below.</p>
    <canvas ref={canvas} width={800} height={240} aria-label="Draw your signature here; alternatively upload a signed form below" style={{ width: "100%", maxWidth: 600, height: 180, touchAction: "none", background: "white", border: "1px solid #8494a3", borderRadius: 8 }}
      onPointerDown={e => { const c = canvas.current!; const ctx = c.getContext("2d")!; const r = c.getBoundingClientRect(); c.setPointerCapture(e.pointerId); drawing.current = true; ctx.beginPath(); ctx.moveTo((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height); }}
      onPointerMove={e => { if (!drawing.current) return; const c=canvas.current!; const r=c.getBoundingClientRect(); const ctx=c.getContext("2d")!; ctx.lineWidth=3; ctx.lineCap="round"; ctx.strokeStyle="#172e40"; ctx.lineTo((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height); ctx.stroke(); setInk(true); }}
      onPointerUp={() => { drawing.current=false; }} onPointerCancel={() => { drawing.current=false; }} />
    <div className="form-actions">
      <button type="button" className="button secondary" disabled={saving} onClick={() => { canvas.current?.getContext("2d")?.clearRect(0,0,800,240); setInk(false); }}>Clear drawing</button>
      <button type="button" className="button" disabled={!ink || saving} onClick={() => { setSaving(true); canvas.current?.toBlob(blob => { if (!blob) { setSaving(false); return; } void onUpload(new File([blob], "signature.png", { type: "image/png" })).finally(() => setSaving(false)); }, "image/png"); }}>{saving ? "Saving…" : "Save signature"}</button>
      <button type="button" className="button secondary" onClick={() => { void download(); }}>Download form to sign</button>
    </div>
    <label>Upload signature or signed form (PNG, JPEG or PDF, up to 5 MB)<input id="verification-signatureDocument" type="file" accept="image/png,image/jpeg,application/pdf" aria-required="true" disabled={saving} onChange={e => { const file=e.target.files?.[0]; if(file) { setSaving(true); void onUpload(file).finally(()=>setSaving(false)); } }} /></label>
    {value ? <DocumentPreview id={value} label="Saved signature or signed form" /> : <p>A saved signature or signed form is required before submission.</p>}
  </section>;
}
