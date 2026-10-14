import { bookingLabel, type Speaker } from "../domain/event-flow";
export type FlyerEvent = {
  id: string; title: string; location: string; starts_at: string; fee_paise: number; visibility: string;
  registration_starts_at: string | null; registration_ends_at: string | null;
  status?:string;booking_closed?:boolean;completed_at?:string|null;archived_at?:string|null;
};
export async function renderFlyer(event: FlyerEvent, speakers: Speaker[], link: string, presentation: {headline?:string;accent?:string;generatedAt?:string} = {}) {
  if (speakers.length < 1 || speakers.length > 6) throw new Error("Choose one to six speakers.");
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
  ctx.fillStyle = presentation.accent==='navy' ? '#ffffff' : "#d0b77a";
  ctx.font = "bold 100px Georgia";
  ctx.fillText("tpa·", 70, 145);
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.fillText("TOLLYGUNGE PROFESSIONAL ASSOCIATION", 70, 205);
  if(event.status==='draft'){ctx.font='bold 20px Arial';ctx.fillText('DRAFT — EVENT NOT YET PUBLISHED',70,240);}
  ctx.fillStyle = "#172a40";
  fitWrap(ctx, event.title, 70, 325, 940, 52, 3, 44, 32, true);
  ctx.font = "26px Arial";
  wrap(ctx, new Date(event.starts_at).toLocaleString("en-IN", {timeZone:"Asia/Kolkata",dateStyle:"long",timeStyle:"short"})+" IST",70,490,940,32,1);
  fitWrap(ctx,event.location,70,535,940,28,2,24,18,false);
  const columns = speakers.length <= 2 ? 1 : 2;
  const rows = Math.ceil(speakers.length / columns);
  const height = Math.floor(490 / rows), width = columns === 1 ? 940 : 460;
  speakers.forEach((speaker,i) => {
    const x = 70 + (i % columns) * 480, top = speakers.length === 1 ? 700 : 600 + Math.floor(i/columns)*height;
    ctx.fillStyle = "#e6e8e2";
    ctx.fillRect(x,top,width,speakers.length === 1 ? 280 : height-12);
    ctx.fillStyle = "#172a40";
    fitWrap(ctx,speaker.name.trim(),x+20,top+(speakers.length === 1 ? 50 : 30),width-40,speakers.length === 1 ? 44 : 28,2,speakers.length === 1 ? 38 : 26,18,true);
    fitWrap(ctx,speaker.credentials.trim(),x+20,top+(speakers.length === 1 ? 130 : 82),width-40,speakers.length === 1 ? 28 : 20,4,speakers.length === 1 ? 26 : 20,16,false);
  });
  ctx.fillStyle = "#172a40";
  ctx.fillRect(0, 1100, 1080, 250);
  const image = new Image();
  image.src = qr;
  await image.decode();
  ctx.drawImage(image, 820, 1130, 190, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Arial";
  fitWrap(ctx,presentation.headline||"CONNECT. LEARN. COLLABORATE.",70,1170,710,34,1,34,16,true);
  ctx.font = "24px Arial";
  ctx.fillText(event.fee_paise ? `Fee ₹${(event.fee_paise/100).toFixed(2)} · manual verification` : "Free registration",70,1215);
  ctx.font = "21px Arial";
  wrap(ctx,bookingLabel(event)+(event.visibility === "members" ? " · Members only" : " · Scan for details"),70,1255,710,26,2);
  if(presentation.generatedAt) {ctx.font='14px Arial';ctx.fillText('Generated '+new Date(presentation.generatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST',70,1325);}
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
  const lines: string[] = [];
  let line = "";
  const nextLine = () => {
    lines.push(line); line = "";
    if(lines.length>=maxLines) throw Error("Text is too long for this flyer layout.");
  };
  for(const word of text.trim().split(/\s+/)) {
    const next=line ? line+" "+word : word;
    if(ctx.measureText(next).width<=width) { line=next;continue; }
    if(ctx.measureText(word).width<=width) {nextLine();line=word;continue;}
    // Fill the remaining width before splitting a long word, preserving every character.
    let separator=line ? " " : "";
    for(const char of word) {
      if(ctx.measureText(char).width>width) throw Error("A character does not fit this flyer.");
      const candidate=line+separator+char;
      if(ctx.measureText(candidate).width>width) {nextLine();line=char;}
      else line=candidate;
      separator="";
    }
  }
  lines.push(line);
  lines.forEach((value,i)=>ctx.fillText(value,x,y+i*lineHeight));
}

function fitWrap(ctx: CanvasRenderingContext2D,text: string,x: number,y: number,width: number,lineHeight: number,maxLines: number,size: number,min: number,bold: boolean) {
  // Measure on a scratch canvas so a failed fit never leaves partial text in the export.
  const scratch=document.createElement("canvas").getContext("2d")!;
  for(let font=size;font>=min;font--) {
    scratch.font=`${bold ? "bold " : ""}${font}px Arial`;
    try { wrap(scratch,text,0,0,width,lineHeight,maxLines);ctx.font=scratch.font;wrap(ctx,text,x,y,width,lineHeight,maxLines);return; } catch {}
  }
  throw Error("Text does not fit the flyer. Shorten the title or speaker details.");
}
