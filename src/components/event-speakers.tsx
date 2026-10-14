"use client";
import type { Speaker } from "@/domain/event-flow";
export function EventSpeakers({ speakers, onChange }: { speakers: Speaker[]; onChange: (speakers: Speaker[]) => void }) {
  function move(i: number, step: number) {
    const next = [...speakers];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onChange(next);
  }
  return <div className="event-speakers">
    {speakers.map((speaker, i) => <fieldset key={i}>
      <legend>Speaker {i + 1}</legend>
      <div className="form-grid">
        <label>Name<input required minLength={2} maxLength={60} value={speaker.name} onChange={(e) => onChange(speakers.map((s, n) => n === i ? { ...s, name: e.target.value } : s))} /></label>
        <label>Credentials / role<input maxLength={120} value={speaker.credentials} onChange={(e) => onChange(speakers.map((s, n) => n === i ? { ...s, credentials: e.target.value } : s))} /></label>
        {(['designation','organization','description'] as const).map(field => <label key={field}>{field==='description'?'Short professional description':field==='designation'?'Designation / title':'Organization'}<input maxLength={field==='description'?500:field==='organization'?160:120} value={speaker[field]??''} onChange={e=>onChange(speakers.map((s,n)=>n===i?{...s,[field]:e.target.value}:s))}/></label>)}
      </div>
      <div className="action-row">
        <button className="button secondary" type="button" aria-label={`Move speaker ${i+1} up`} disabled={i === 0} onClick={() => move(i,-1)}>Move up</button>
        <button className="button secondary" type="button" aria-label={`Move speaker ${i+1} down`} disabled={i === speakers.length-1} onClick={() => move(i,1)}>Move down</button>
        <button className="button secondary" type="button" aria-label={`Remove speaker ${i+1}`} onClick={() => onChange(speakers.filter((_, n) => n !== i))}>Remove</button>
      </div>
    </fieldset>)}
    <button className="button secondary" type="button" disabled={speakers.length >= 6} onClick={() => onChange([...speakers,{ name: "", credentials: "" }])}>Add speaker</button>
    <p className="field-help">Up to six speakers, in the order shown on event details and flyers.</p>
  </div>;
}
