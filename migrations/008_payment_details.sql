CREATE TABLE tpa.payment_qr_images (
 id UUID PRIMARY KEY, uploaded_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
 width INTEGER NOT NULL,height INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.payment_details (
 id UUID PRIMARY KEY, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','past')),
 draft JSONB NOT NULL, active_snapshot JSONB, version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.payment_detail_revisions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, detail_id UUID NOT NULL REFERENCES tpa.payment_details(id),
 version INTEGER NOT NULL, status TEXT NOT NULL, details JSONB NOT NULL,
 actor_user_id TEXT REFERENCES public."user"(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(detail_id,version)
);
