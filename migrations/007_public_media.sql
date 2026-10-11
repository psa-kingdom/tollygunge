-- Public assets are separate from private application documents, including object keys.
CREATE TABLE tpa.public_media (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  category TEXT NOT NULL,
  draft JSONB NOT NULL,
  published JSONB,
  content_type TEXT NOT NULL CHECK(content_type='image/webp'),
  byte_size INTEGER NOT NULL CHECK(byte_size>0 AND byte_size<=5242880),
  width INTEGER NOT NULL CHECK(width>0 AND width<=2400),
  height INTEGER NOT NULL CHECK(height>0 AND height<=2400),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  uploaded_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
