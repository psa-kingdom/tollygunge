import { getDatabase } from "@/lib/database";
import { authConfigured } from "@/lib/auth";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!authConfigured()) throw new Error("Unavailable");
    await getDatabase().query("SELECT 1");
    let backgroundProcesses = "unknown";
    try {
      const health = JSON.parse(await readFile(join(tmpdir(), `tpa-runtime-health-${process.env.PORT || "3000"}.json`), "utf8"));
      const fresh = Date.now() - Date.parse(health.updatedAt) < 120000;
      backgroundProcesses = fresh && health.workers.email === "running" && health.workers.import === "running" ? "running" : "degraded";
    } catch { /* Local next start has no supervisor. */ }
    return Response.json(
      { status: "ready", backgroundProcesses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
