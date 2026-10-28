import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRuntime } from "../scripts/start-runtime.mjs";

function fixture() {
  const children = [], timers = [], exits = [], states = [];
  const runtime = startRuntime({
    env: { RESEND_RECEIVING_API_KEY: "private", RESEND_API_KEY: "sending", R2_ACCESS_KEY_ID: "storage" },
    spawnProcess: (_node, [file], options) => {
      const child = new EventEmitter();
      Object.assign(child, { file, options, signals: [], kill(signal) { this.signals.push(signal); } });
      children.push(child);
      return child;
    },
    schedule: (fn, delay) => { const timer = { fn, delay, cancelled: false, unref() {} }; timers.push(timer); return timer; },
    cancel: timer => { if (timer) timer.cancelled = true; },
    exit: code => exits.push(code), report: () => {},
    publish: state => states.push(structuredClone(state)),
  });
  return { runtime, children, timers, exits, states };
}

test("worker crashes leave web alive, restart with capped backoff and recover", () => {
  const f = fixture();
  const web = f.children[0];
  let worker = f.children[1];
  for (const expected of [5000, 10000, 20000, 40000, 60000, 60000]) {
    worker.emit("spawn"); worker.emit("close", 1);
    assert.equal(f.states.at(-1).workers.email, "restarting");
    assert.deepEqual(web.signals, []); assert.deepEqual(f.exits, []);
    const timer = f.timers.at(-1); assert.equal(timer.delay, expected);
    timer.fn(); worker = f.children.at(-1);
  }
  worker.emit("spawn");
  assert.equal(f.states.at(-1).workers.email, "running");
  f.runtime.stop();
});
test("web exit, including unexpected zero exit, stops workers and exits nonzero", () => {
  for (const code of [0, 2, null]) {
    const f = fixture(); f.children[0].emit("close", code);
    for (const worker of f.children.slice(1)) { assert.deepEqual(worker.signals, ["SIGTERM"]); worker.emit("close", 0); }
    assert.equal(f.exits.at(-1), code || 1);
  }
});
test("graceful shutdown cancels restarts and force kills stuck children", () => {
  const f = fixture(); f.children[1].emit("close", 1);
  const restart = f.timers.at(-1); f.runtime.stop();
  assert.equal(restart.cancelled, true);
  restart.fn(); assert.equal(f.children.length, 3);
  f.timers.at(-1).fn();
  assert.deepEqual(f.children[0].signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(f.exits.at(-1), 0);
});
test("worker environments retain credential boundaries", () => {
  const f = fixture();
  assert.equal(f.children[0].options.env.RESEND_RECEIVING_API_KEY, undefined);
  assert.equal(f.children[0].options.env.RESEND_RECEIVING_CONFIGURED, "true");
  assert.equal(f.children[1].options.env.RESEND_RECEIVING_API_KEY, "private");
  assert.equal(f.children[2].options.env.RESEND_API_KEY, undefined);
  assert.equal(f.children[2].options.env.R2_ACCESS_KEY_ID, undefined);
  f.runtime.stop();
});
test("real worker crash and restart preserve HTTP availability; web crash terminates supervisor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tpa-runtime-test-"));
  let child;
  try {
    await cp(new URL("../scripts/start-runtime.mjs", import.meta.url), join(dir, "start-runtime.mjs"));
    await writeFile(join(dir, "server.js"), `const http=require('node:http');const server=http.createServer((req,res)=>{res.end('ready');if(req.url==='/exit')setTimeout(()=>process.exit(2),50);});server.listen(0,'127.0.0.1',()=>console.log('TEST_PORT='+server.address().port));`);
    await writeFile(join(dir, "email-worker.mjs"), `console.log('TEST_EMAIL_START');process.exit(1);`);
    await writeFile(join(dir, "member-import-worker.mjs"), `setInterval(()=>{},1000);`);
    child = spawn(process.execPath, ["start-runtime.mjs"], { cwd: dir, env: { ...process.env, PORT: `test-${process.pid}` }, stdio: ["ignore", "pipe", "pipe"] });
    const closed = new Promise(resolve => child.once("close", resolve));
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", () => {});
    const until = async predicate => { for (let n=0;n<100;n++) { if(await predicate())return; await new Promise(resolve=>setTimeout(resolve,100)); } throw Error("Runtime fixture timed out"); };
    await until(() => /TEST_PORT=(\d+)/.test(output));
    const url = "http://127.0.0.1:" + output.match(/TEST_PORT=(\d+)/)[1];
    assert.equal((await fetch(url)).status, 200);
    let health;
    // HTTP readiness and worker exit are independent OS events. Observe the
    // actual restart state instead of assuming the crash happened before fetch.
    await until(async () => {
      try { health = JSON.parse(await (await import("node:fs/promises")).readFile(join(tmpdir(), `tpa-runtime-health-test-${process.pid}.json`), "utf8")); }
      catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) return false; throw error; }
      return health.workers.email === "restarting";
    });
    assert.equal(health.workers.email, "restarting");
    assert.equal((await fetch(url)).status, 200);
    await until(() => output.split("TEST_EMAIL_START").length >= 3);
    assert.equal((await fetch(url)).status, 200);
    await fetch(url + "/exit");
    assert.equal(await closed, 2);
  } finally {
    child?.kill();
    await rm(dir, { recursive: true, force: true });
    await rm(join(tmpdir(), `tpa-runtime-health-test-${process.pid}.json`), { force: true });
  }
});
