CREATE TABLE tpa.member_import_jobs (
 id uuid PRIMARY KEY, batch_id uuid NOT NULL REFERENCES tpa.onboarding_batches(id),
 batch_version integer NOT NULL, actor_id text NOT NULL REFERENCES public."user"(id),
 source_hash text, policy jsonb NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','completed-with-issues','paused')),
 generation integer NOT NULL DEFAULT 0, lease_owner text, lease_until timestamptz,
 heartbeat_at timestamptz, last_progress_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(batch_id,batch_version)
);
CREATE TABLE tpa.member_import_job_rows (
 job_id uuid NOT NULL REFERENCES tpa.member_import_jobs(id), source_row integer NOT NULL,
 ordinal integer NOT NULL, input jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retry','created','skipped','conflict','invalid','failed')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 result jsonb, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,source_row), UNIQUE(job_id,ordinal)
);
CREATE INDEX member_import_jobs_claim ON tpa.member_import_jobs(state,lease_until,created_at);
CREATE INDEX member_import_rows_pending ON tpa.member_import_job_rows(job_id,status,available_at,ordinal);
CREATE TABLE tpa.member_import_worker_state (
 id text PRIMARY KEY, heartbeat_at timestamptz NOT NULL DEFAULT now(), enabled boolean NOT NULL
);
