"use client";
import { speakerDesignation, speakerDesignationLimit, type Speaker } from "@/domain/event-flow";
export function EventSpeakers({ speakers, onChange }: { speakers: Speaker[]; onChange: (speakers: Speaker[]) => void }) {
  function move(i: number, step: number) {
    const next = [...speakers];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onChange(next);
  }
  function update(index: number, speaker: Speaker) {
    onChange(speakers.map((current, i) => i === index ? speaker : current));
  }
  return <div className="event-speakers">
    {speakers.map((speaker, i) => <fieldset key={i}>
      <legend>Speaker {i + 1}</legend>
      <div className="form-grid">
        <label>Name<input required minLength={2} maxLength={60} value={speaker.name} onChange={(e) => update(i, { ...speaker, name: e.target.value })} /></label>
        <label>Designation / Organisation<input maxLength={speakerDesignationLimit} value={speakerDesignation(speaker)} onChange={(e) => update(i, { name: speaker.name, credentials: "", designationOrganisation: e.target.value, description: speaker.description })} /></label>
        <label>Description<input maxLength={500} value={speaker.description ?? ""} onChange={(e) => update(i, { ...speaker, description: e.target.value })} /></label>
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
