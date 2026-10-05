"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import NextImage from "next/image";
type Speaker = { name: string; credentials: string };
type Event = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  speakers: Speaker[] | null;
  template_version: number;
};
export function FlyerBuilder() {
  const [events, setEvents] = useState<Event[]>([]),
    [event, setEvent] = useState<Event | null>(null),
    [speakers, setSpeakers] = useState<Speaker[]>([
      { name: "", credentials: "" },
    ]),
    [image, setImage] = useState(""),
    [message, setMessage] = useState("Loading published events…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Event[]>("/api/staff/flyers")
      .then(setEvents)
      .then(() => setMessage(""))
      .catch((e) => setMessage(e.message));
  }, []);
  async function generate() {
    if (!event) return;
    setBusy(true);
    setMessage("");
    try {
      setImage(
        await renderFlyer(
          event,
          speakers,
          `${window.location.origin}/events/${event.id}`,
        ),
      );
      setMessage("Preview generated. The QR opens this published event.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operations-layout">
      <section>
        <h2>Event flyer</h2>
        <p>
          One or two speakers, with a registration QR. Only published events can
          be promoted.
        </p>
        <form
          className="member-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <label>
            Published event
            <select
              value={event?.id ?? ""}
              onChange={(e) => {
                const row =
                  events.find((item) => item.id === e.target.value) ?? null;
                setEvent(row);
                setSpeakers(row?.speakers ?? [{ name: "", credentials: "" }]);
                setImage("");
              }}
            >
              <option value="">Choose event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          {events.length === 0 && <p>Publish an event to create its flyer.</p>}
          <label>
            Speaker layout
            <select
              value={speakers.length}
              onChange={(e) => {
                setSpeakers(
                  Number(e.target.value) === 1
                    ? [speakers[0]]
                    : [speakers[0], { name: "", credentials: "" }],
                );
                setImage("");
              }}
            >
              <option value={1}>One speaker</option>
              <option value={2}>Two speakers</option>
            </select>
          </label>
          {speakers.map((s, i) => (
            <fieldset key={i}>
              <legend>Speaker {i + 1}</legend>
              <label>
                Name
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={s.name}
                  onChange={(e) => {
                    setSpeakers(
                      speakers.map((value, j) =>
                        i === j ? { ...value, name: e.target.value } : value,
                      ),
                    );
                    setImage("");
                  }}
                />
              </label>
              <label>
                Credentials / role
                <input
                  maxLength={120}
                  value={s.credentials}
                  onChange={(e) => {
                    setSpeakers(
                      speakers.map((value, j) =>
                        i === j
                          ? { ...value, credentials: e.target.value }
                          : value,
                      ),
                    );
                    setImage("");
                  }}
                />
              </label>
            </fieldset>
          ))}
          <div className="action-row">
            <button className="button" disabled={busy || !event}>
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
                  setMessage("Reusable speaker template saved.");
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Save failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save template
            </button>
          </div>
        </form>
        <p role="status">{message}</p>
        {image && (
          <div className="action-row">
            <a
              className="button secondary"
              href={image}
              download="tpa-event-flyer.png"
            >
              Download PNG
            </a>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
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
                } catch {
                  setMessage("PDF export failed. Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download PDF
            </button>
          </div>
        )}
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
          <p className="notice">
            Generate a preview to inspect the flyer before exporting.
          </p>
        )}
      </section>
    </div>
  );
}
async function renderFlyer(event: Event, speakers: Speaker[], link: string) {
  if (speakers.some((s) => s.name.trim().length < 2))
    throw new Error("Provide each speaker name.");
  const QRCode = (await import("qrcode")).default,
    qr = await QRCode.toDataURL(link, {
      width: 190,
      margin: 2,
      errorCorrectionLevel: "M",
    });
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5f4ef";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#172a40";
  ctx.fillRect(0, 0, 1080, 260);
  ctx.fillStyle = "#d0b77a";
  ctx.font = "bold 100px Georgia";
  ctx.fillText("tpa·", 70, 145);
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.fillText("TOLLYGUNGE PROFESSIONAL ASSOCIATION", 70, 205);
  ctx.fillStyle = "#172a40";
  ctx.font = "bold 54px Arial";
  wrap(ctx, event.title, 70, 340, 940, 66, 4);
  ctx.font = "26px Arial";
  wrap(
    ctx,
    new Date(event.starts_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "long",
      timeStyle: "short",
    }) + " IST",
    70,
    620,
    940,
    34,
    2,
  );
  wrap(ctx, event.location, 70, 700, 940, 34, 2);
  speakers.forEach((speaker, i) => {
    const y = 810 + i * 135;
    ctx.fillStyle = "#e6e8e2";
    ctx.fillRect(70, y - 35, 940, 120);
    ctx.fillStyle = "#172a40";
    ctx.font = "bold 30px Arial";
    wrap(ctx, speaker.name.trim(), 95, y, 890, 35, 1);
    ctx.font = "22px Arial";
    wrap(ctx, speaker.credentials.trim(), 95, y + 38, 890, 27, 2);
  });
  ctx.fillStyle = "#172a40";
  ctx.fillRect(0, 1100, 1080, 250);
  const image = new Image();
  image.src = qr;
  await image.decode();
  ctx.drawImage(image, 820, 1130, 190, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Arial";
  ctx.fillText("CONNECT. LEARN. COLLABORATE.", 70, 1170);
  ctx.font = "26px Arial";
  ctx.fillText("Free registration · Scan to view event", 70, 1220);
  ctx.font = "20px Arial";
  ctx.fillText(
    "Attendance is recorded separately from registration.",
    70,
    1270,
  );
  return canvas.toDataURL("image/png");
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/);
  let line = "",
    row = 0;
  for (const word of words) {
    if (ctx.measureText(word).width > width)
      throw new Error("A word is too long for this flyer. Shorten the text.");
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > width) {
      if (++row >= maxLines)
        throw new Error(
          "Text is too long for this flyer layout. Shorten the title or speaker details.",
        );
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else line = next;
  }
  ctx.fillText(line, x, y);
}
