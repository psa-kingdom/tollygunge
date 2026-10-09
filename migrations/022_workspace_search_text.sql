-- Additional searchable business text, separated from private file bytes and encrypted delivery payloads.
CREATE INDEX workspace_email_body_search ON tpa.email_messages USING gin (body gin_trgm_ops);
CREATE INDEX workspace_template_search ON tpa.communication_templates USING gin ((coalesce(name,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(body,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_source_search ON tpa.news_sources USING gin ((coalesce(name,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(url,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_content_intro_search ON tpa.content_entries USING gin ((draft->>'intro') gin_trgm_ops);
