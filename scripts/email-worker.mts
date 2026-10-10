process.on("uncaughtException", () => {
  console.error("Email worker unavailable; diagnostics withheld.");
  process.exit(1);
});
process.on("unhandledRejection", () => {
  console.error("Email worker unavailable; diagnostics withheld.");
  process.exit(1);
});
import { fetchEmailQuota } from "../src/lib/email-provider";
import { runOnboardingTick } from "../src/lib/onboarding-delivery";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { databaseOptions } from "../src/lib/database-options";
import { emailConfigured } from "../src/domain/email";
import {
  claimEmailJob,
  processEmailJob,
  recoverEmailLeases,
} from "../src/lib/email-worker";
const pool = new Pool({ ...databaseOptions(), max: 3 });
const owner = randomUUID();
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stopping = true;
  });
const wait = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000);
    timer.unref();
  });
const leadership = await pool.connect();
let elected = false;
while (!stopping && !elected) {
  elected = (
    await leadership.query("SELECT pg_try_advisory_lock(74672019) AS leader")
  ).rows[0].leader;
  if (!elected) await wait();
}
leadership.on("error", () => {
  console.error("Email worker leadership lost.");
  process.exit(1);
});
pool.on("error", () => {
  console.error("Email worker database connection unavailable.");
  process.exit(1);
});
if (!elected) {
  leadership.release();
  await pool.end();
} else {
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let providerHealthy = false,
    quotaAt = 0;
  const beat = async () => {
    try {
      const requested =
        emailConfigured() || process.env.ONBOARDING_ENABLED === "true";
      if (requested && Date.now() - quotaAt > 60000) {
        quotaAt = Date.now();
        try {
          const quota = await fetchEmailQuota(
            process.env.RESEND_RECEIVING_API_KEY!,
          );
          await pool.query(
            "UPDATE tpa.email_worker_state SET quota=$1,quota_checked_at=now() WHERE id='email'",
            [quota],
          );
          providerHealthy = true;
        } catch {
          providerHealthy = false;
        }
      }
      await pool.query(
        "INSERT INTO tpa.email_worker_state(id,heartbeat_at,status) VALUES('email',now(),$1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),status=EXCLUDED.status",
        [
          emailConfigured()
            ? providerHealthy
              ? "ready"
              : "provider_unavailable"
            : "disabled",
        ],
      );
    } catch {
      console.error("Email worker heartbeat unavailable.");
    }
  };
  try {
    await pool.query(
      "INSERT INTO tpa.email_worker_state(id,heartbeat_at,status) VALUES('email',now(),'disabled') ON CONFLICT(id) DO NOTHING",
    );
    await beat();
    heartbeat = setInterval(() => void beat(), 10000);
    heartbeat.unref();
    while (!stopping) {
      if (providerHealthy) await runOnboardingTick(pool);
      if (emailConfigured() && providerHealthy) {
        await recoverEmailLeases(pool);
        const job = await claimEmailJob(pool, owner);
        if (job) await processEmailJob(pool, job.id, owner, process.env);
      }
      await wait();
    }
  } catch {
    console.error("Email worker stopped; diagnostics withheld.");
    process.exitCode = 1;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await leadership
      .query("SELECT pg_advisory_unlock(74672019)")
      .catch(() => {});
    leadership.release();
    await pool.end();
  }
}
