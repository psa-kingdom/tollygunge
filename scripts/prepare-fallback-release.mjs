import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = ".local/main-publish/deploy-final";
const target = ".local/fallback-release/source";
await mkdir(target, { recursive: true });
await cp(base, target, { recursive: true });
const files = ["scripts/start-runtime.mjs", "src/domain/worker-diagnostics.ts", "src/domain/fallbacks.ts", "src/components/fallback-screen.tsx", "src/components/fallback-screen.module.css", "src/components/loading-screen.tsx", "src/components/operations-client.ts", "src/app/not-found.tsx", "src/app/global-not-found.tsx", "src/app/error.tsx", "src/app/global-error.tsx", "src/app/loading.tsx", "src/app/admin/loading.tsx", "src/app/member/loading.tsx", "src/app/api/health/route.ts", "tests/runtime-supervisor.test.mjs", "tests/fallbacks.test.ts", "tests/request-fallbacks.test.ts"];
for (const file of files) { await mkdir(target + "/" + file.slice(0, file.lastIndexOf("/")), { recursive: true }); await cp(file, target + "/" + file); }
async function change(file, transform) {
  const before = await readFile(target + "/" + file, "utf8");
  const after = transform(before.replaceAll("\r\n", "\n"));
  if (after === before.replaceAll("\r\n", "\n")) throw Error("No patch applied: " + file);
  await writeFile(target + "/" + file, after);
}
await change("next.config.mjs", s => s.replace('output: "standalone",', 'output: "standalone",\n  outputFileTracingRoot: process.cwd(),\n  turbopack: { root: process.cwd() },\n  experimental: { globalNotFound: true },'));
await change("scripts/email-worker.mts", s => 'import { workerFailureCategory } from "../src/domain/worker-diagnostics";\n' + s
  .replace('process.on("uncaughtException", () => {', 'process.on("uncaughtException", (error) => {')
  .replace('process.on("unhandledRejection", () => {', 'process.on("unhandledRejection", (error) => {')
  .replaceAll('console.error("Email worker unavailable; diagnostics withheld.");', 'console.error("Email worker unavailable:", workerFailureCategory(error));')
  .replace('leadership.on("error", () => {', 'leadership.on("error", (error) => {')
  .replace('console.error("Email worker leadership lost.");', 'console.error("Email worker leadership lost:", workerFailureCategory(error));')
  .replace('pool.on("error", () => {', 'pool.on("error", (error) => {')
  .replace('console.error("Email worker database connection unavailable.");', 'console.error("Email worker database connection unavailable:", workerFailureCategory(error));')
  .replaceAll('} catch {', '} catch (error) {')
  .replace('providerHealthy = false;\n        }', 'providerHealthy = false;\n          console.error("Email provider unavailable:", workerFailureCategory(error));\n        }')
  .replace('console.error("Email worker heartbeat unavailable.");', 'console.error("Email worker heartbeat unavailable:", workerFailureCategory(error));')
  .replace('console.error("Email worker stopped; diagnostics withheld.");', 'console.error("Email worker stopped:", workerFailureCategory(error));'));
await change("src/components/password-controls.tsx", s => s.replace('const client = createAuthClient();', 'import { FallbackPanel } from "./fallback-screen";\nimport { LoadingScreen } from "./loading-screen";\nconst client = createAuthClient();')
  .replace('if (token === null) return <p role="status">Checking reset link…</p>;', 'if (token === null) return <LoadingScreen />;')
  .replace(/<p>\s*This link is missing or expired\.\{" "\}\s*<Link href="\/forgot-password">Request a new reset link\.<\/Link>\s*<\/p>/, '<FallbackPanel kind="expiredLink" />'));
await change("src/components/member-events.tsx", s => s.replace('type Event = {', 'import { FallbackPanel } from "./fallback-screen";\nimport { LoadingScreen } from "./loading-screen";\ntype Event = {')
  .replace('  useEffect(() => {', '  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");\n  const loadEvents = () => {\n    setLoadState("loading");\n    return api<Event[]>("/api/member/events").then(rows => { setEvents(rows); setMessage(""); setLoadState("ready"); }).catch(e => { setMessage(e.message); setLoadState("error"); });\n  };\n  useEffect(() => {')
  .replace('.then(() => setMessage(""))', '.then(() => { setMessage(""); setLoadState("ready"); })')
  .replace('.catch((e) => setMessage(e.message));', '.catch((e) => { setMessage(e.message); setLoadState("error"); });')
  .replace(/\{events.length === 0 && \(\s*<p>No published events or registration history yet\.<\/p>\s*\)\}/, '{loadState === "loading" && <LoadingScreen />}\n      {loadState === "error" && <FallbackPanel kind="unavailable" retry={() => { void loadEvents(); }} />}\n      {loadState === "ready" && events.length === 0 && <FallbackPanel kind="emptyEvents" />}'));
const changes = [];
async function walk(path = "") {
  for (const entry of await readdir(target + "/" + path, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".local"].includes(entry.name)) continue;
    const file = path + entry.name;
    if (entry.name.endsWith(".tsbuildinfo")) continue;
    if (entry.isDirectory()) { await walk(file + "/"); continue; }
    const bytes = await readFile(target + "/" + file);
    const previous = await readFile(base + "/" + file).catch(() => null);
    if (!previous || bytes.toString().replaceAll("\r\n", "\n") !== previous.toString().replaceAll("\r\n", "\n")) changes.push({ path: file, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}
await walk();
await writeFile(".local/fallback-release/manifest.json", JSON.stringify({ target, baseCommit: "6532f3a9d8a58ae462a9902fce95fe01bce4d8a4", priorDeployment: "7359d379-a8f7-468e-a9d7-a8568560cf21", changes, migrations: "unchanged", flags: "unchanged", resources: "unchanged" }, null, 2));
console.log(JSON.stringify({ target, changed: changes.map(c => c.path) }));
