import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const alt = "Tollygunge Professional Association — Connect. Learn. Collaborate.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/design/tpa-logo.png"));
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#edf1ee", color: "#192c38", padding: 64, flexDirection: "column", justifyContent: "space-between" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} width={100} height={112} alt="TPA" />
      <div style={{ display: "flex", flexDirection: "column", fontSize: 27, letterSpacing: 2 }}><span>TOLLYGUNGE</span><span>PROFESSIONAL ASSOCIATION</span></div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", fontSize: 70, fontWeight: 700, lineHeight: 1.15 }}><span>Good people.</span><span>Shared progress.</span></div>
    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 22, borderTop: "2px solid #d5b878", fontSize: 24 }}><span>Connect. Learn. Collaborate.</span><span>tpassociation.org</span></div>
  </div>, size);
}
