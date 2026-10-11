-- Additive search/attention indexes; no existing data or frozen versions are rewritten.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX workspace_user_search ON public."user" USING gin ((coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(id,'')) gin_trgm_ops);
CREATE INDEX workspace_event_search ON tpa.events USING gin ((coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_inquiry_search ON tpa.inquiries USING gin ((coalesce(subject,'') || ' ' || coalesce(message,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_content_search ON tpa.content_entries USING gin ((coalesce(slug,'') || ' ' || coalesce(draft->>'title','') || ' ' || coalesce(draft->>'summary','') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_media_search ON tpa.public_media USING gin ((coalesce(title,'') || ' ' || coalesce(alt_text,'') || ' ' || coalesce(category,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_inbox_search ON tpa.email_conversations USING gin ((coalesce(subject,'') || ' ' || coalesce(correspondent,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX workspace_campaign_search ON tpa.campaign_drafts USING gin ((coalesce(name,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(body,'') || ' ' || coalesce(id::text,'')) gin_trgm_ops);
CREATE INDEX verification_queue_search ON tpa.verification_submissions(status,created_at DESC);
CREATE INDEX attention_inquiries_due ON tpa.inquiries(follow_up_at) WHERE status<>'closed';
CREATE INDEX attention_inquiries_unassigned ON tpa.inquiries(status) WHERE assigned_to IS NULL;
CREATE INDEX onboarding_batches_owner_search ON tpa.onboarding_batches(actor_id,created_at DESC);
