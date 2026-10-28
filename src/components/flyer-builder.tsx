"use client";
import { useState, useEffect } from "react";
import { EventSpeakers } from "./event-speakers";
import { eventLink, type Speaker } from "@/domain/event-flow";
import { api } from "./operations-client";
import { renderFlyer } from "@/lib/flyer-canvas";
import NextImage from "next/image";
import { WorkspaceEmptyState, WorkspaceSteps } from "./workspace-ui";
type Variant={id:string;event_id:string;name:string;headline:string;presentation:{accent:string};status:string;version:number};
type Event = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  speakers: Speaker[] | null;
  template_version: number;
  fee_paise: number;
  visibility: string;
  status?:string;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
};
export function FlyerBuilder() {
  const [events, setEvents] = useState<Event[]>([]),
    [event, setEvent] = useState<Event | null>(null),
    [speakers, setSpeakers] = useState<Speaker[]>([
      { name: "", credentials: "" },
    ]),
    [image, setImage] = useState(""),
    [message, setMessage] = useState("Loading events…"),
    [busy, setBusy] = useState(false);
  const [variants,setVariants]=useState<Variant[]>([]),[variant,setVariant]=useState<Variant|null>(null),[variantName,setVariantName]=useState('Standard flyer'),[headline,setHeadline]=useState(''),[accent,setAccent]=useState('gold'),[generatedAt,setGeneratedAt]=useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(()=>{let active=true;if(event?.id) api<Variant[]>(`/api/staff/flyer-variants?eventId=${event.id}`).then(rows=>{if(active)setVariants(rows);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[event?.id]);
  function chooseVariant(row:Variant|null) {setVariant(row);setVariantName(row?.name??'Standard flyer');setHeadline(row?.headline??'');setAccent(row?.presentation.accent??'gold');setImage('');}
  async function checkFresh() {
    if(!event) throw Error('Choose an event.');
    const latest=(await api<Event[]>(`/api/staff/flyers?id=${event.id}`))[0];
    if(!latest||latest.template_version!==event.template_version) {setImage('');throw Error('Event changed. Reload and regenerate the preview.');}
    if(JSON.stringify(speakers)!==JSON.stringify(latest.speakers)) {setImage('');throw Error('Save event speakers before generating or exporting.');}
    if(variant) {const rows=await api<Variant[]>(`/api/staff/flyer-variants?eventId=${event.id}`);if(rows.find(r=>r.id===variant.id)?.version!==variant.version) {setImage('');throw Error('Variant changed. Reload before generating or exporting.');}}
  }
  useEffect(() => {
    api<Event[]>("/api/staff/flyers" + (location.search || ""))
      .then((rows) => {
        setEvents(rows);
        const id = new URLSearchParams(location.search).get("id");
        const chosen = rows.find((r) => r.id === id);
        if (chosen) {
          setEvent(chosen);
          setSpeakers(chosen.speakers?.length ? chosen.speakers : [{ name: "", credentials: "" }]);
        }
      })
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, []);
  async function generate() {
    if (!event) return;
    setBusy(true);
    setMessage("");
    try {
      await checkFresh();
      const timestamp=new Date().toISOString();
      setImage(
        await renderFlyer(
          event,
          speakers,
          eventLink(window.location.origin,event),
          {headline,accent,generatedAt:timestamp},
        ),
      );
      setGeneratedAt(timestamp);
      setMessage(event.status==='draft'?"Preview generated. Draft event: its registration QR becomes available after publication.":"Preview generated. The QR opens this published event.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!loaded) return <p role="status">Loading events…</p>;
  if (!events.length && !message) return <WorkspaceEmptyState icon="image" title="Create an event before designing its flyer" description="Flyers use the event title, speakers, venue and registration details. Save an event draft first, then return here to prepare its flyer." actionLabel="Create an event" href="/admin/workspaces/events" />;
  return (
    <>
    <WorkspaceSteps steps={["Choose event", "Prepare content", "Preview & export"]} current={!event ? 0 : image ? 2 : 1} />
    <div className="operations-layout flyer-workspace">
      <section>
        <h2>Event flyer</h2>
        <p>
          One to six speakers, with a registration QR. Draft events can be previewed;
          publish the event before sharing its flyer.
        </p>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <label>
            Event
            <select
              disabled={busy}
              value={event?.id ?? ""}
              onChange={(e) => {
                const row =
                  events.find((item) => item.id === e.target.value) ?? null;
                setEvent(row);
                setSpeakers(row?.speakers?.length ? row.speakers : [{ name: "", credentials: "" }]);
                setImage("");
                chooseVariant(null);
              }}
            >
              <option value="">Choose event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}{e.status==='draft'?' · Draft preview':''}
                </option>
              ))}
            </select>
          </label>
          {event && <fieldset disabled={busy}><legend>Flyer variants</legend>
            <label>Saved variant<select value={variant?.id??''} onChange={e=>chooseVariant(variants.find(v=>v.id===e.target.value)??null)}><option value="">New variant</option>{variants.map(v=><option key={v.id} value={v.id}>{v.name} · {v.status}</option>)}</select></label>
            <label>Variant name<input value={variantName} maxLength={80} onChange={e=>{setVariantName(e.target.value);setImage('');}}/></label>
            <label>Promotional headline<input value={headline} maxLength={60} onChange={e=>{setHeadline(e.target.value);setImage('');}}/></label>
            <label>Accent<select value={accent} onChange={e=>{setAccent(e.target.value);setImage('');}}><option value="gold">Gold</option><option value="navy">Navy</option></select></label>
            <div className="action-row">{['draft','published','archived'].map(status=><button key={status} type="button" className="button secondary" disabled={busy||(status==='published'&&!image)||(!variant&&status==='archived')} onClick={async()=>{setBusy(true);try{await checkFresh();const saved=await api<Variant>('/api/staff/flyer-variants',{id:variant?.id,version:variant?.version??0,eventId:event.id,eventVersion:event.template_version,name:variantName,headline,presentation:{accent},status});setVariant(saved);setVariants(await api(`/api/staff/flyer-variants?eventId=${event.id}`));setImage('');setMessage(status==='published'?'Flyer published. Its shared view uses current event details.':'Variant saved. Regenerate the preview before export.');}catch(e){setMessage(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}}}>{status==='draft'?'Save variant':status==='published'?'Publish flyer':'Archive variant'}</button>)}</div>
            {variant?.status==='published'&&<a className="text-link" href={`/flyers/${variant.id}`}>Open shared flyer →</a>}
          </fieldset>}
          {events.length === 0 && <p>Create an event to prepare its flyer.</p>}
          {event && <><fieldset disabled={busy}><legend>Event speakers</legend><EventSpeakers speakers={speakers} onChange={(rows) => { setSpeakers(rows); setImage(""); }} /></fieldset>
          <p>Saving updates the shared speaker list on event details and future flyers.</p>
          <div className="action-row">
            <button className="button" disabled={busy || !event || !speakers.length}>
              Generate preview
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !event}
              onClick={async () => {
                if (!event) return;
                setBusy(true);
                try {
                  const result = await api<{ version: number }>(
                    "/api/staff/flyers",
                    {
                      eventId: event.id,
                      version: event.template_version,
                      speakers,
                    },
                  );
                  setEvent({
                    ...event,
                    template_version: result.version,
                    speakers,
                  });
                  setEvents((items) =>
                    items.map((item) =>
                      item.id === event.id
                        ? {
                            ...item,
                            template_version: result.version,
                            speakers,
                          }
                        : item,
                    ),
                  );
                  setMessage("Event speakers saved.");
                  setImage('');
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Save failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save event speakers
            </button>
          </div>
          </>}
        </form>
        <p role="status">{message}</p>
        {image && (
          <div className="action-row">
            <button type="button"
              className="button secondary"
              disabled={busy}
              onClick={async()=>{setBusy(true);try{await checkFresh();const link=document.createElement('a');link.href=image;link.download='tpa-event-flyer.png';link.click();}catch(e){setMessage(e instanceof Error?e.message:'Export failed.');}finally{setBusy(false);}}}
            >
              Download PNG
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await checkFresh();
                  const { jsPDF } = await import("jspdf");
                  const pdf = new jsPDF({
                    compress: true,
                    orientation: "portrait",
                    unit: "px",
                    format: [1080, 1350],
                    hotfixes: ["px_scaling"],
                  });
                  pdf.addImage(
                    image,
                    "PNG",
                    0,
                    0,
                    1080,
                    1350,
                    undefined,
                    "FAST",
                  );
                  pdf.save("tpa-event-flyer.pdf");
                  setMessage("PDF export prepared.");
                } catch (error) {
                  setMessage(error instanceof Error?error.message:"PDF export failed. Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download PDF
            </button>
          </div>
        )}
        {image&&<p className="field-help">Generated {new Date(generatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST. Downloaded files are static.</p>}
      </section>
      <section aria-label="Flyer preview">
        {image ? (
          <NextImage
            className="flyer-preview"
            src={image}
            alt="Generated TPA event flyer with speaker details and registration QR"
            width={1080}
            height={1350}
            unoptimized
          />
        ) : (
          <WorkspaceEmptyState icon="image" title="Your flyer preview" description={event ? "Prepare the event content, then generate a preview to inspect the layout and registration QR before exporting." : "Choose an event to begin. Its content and speaker details will be used in the flyer."} />
        )}
      </section>
    </div>
    </>
  );
}
