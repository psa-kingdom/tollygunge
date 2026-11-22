CREATE TABLE tpa.event_banners (
  event_id UUID PRIMARY KEY REFERENCES tpa.events(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  image BYTEA NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 2097152)
);
