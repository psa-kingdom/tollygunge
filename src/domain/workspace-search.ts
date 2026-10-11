import { hasPermission, type Permission } from "./access";
export type SearchSource = {
  group: string;
  permission: Permission;
  alternativePermission?: Permission;
  sql: string;
  path: string;
  parameter?: string;
  owned?: boolean;
};
// Only explicit business columns are searchable. No payload/object keys or private file contents.
export const searchSources: SearchSource[] = [
  {
    group: "Members",
    permission: "members:review",
    sql: `SELECT id::text id,name title,email summary FROM public."user" WHERE (coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' ORDER BY name LIMIT 4`,
    path: "/admin/workspaces/members",
  },
  {
    group: "Verification",
    permission: "members:review",
    sql: `SELECT s.id::text id,u.name title,concat(u.email,' · ',s.status) summary FROM tpa.verification_submissions s JOIN public."user" u ON u.id=s.user_id WHERE (coalesce(u.name,'') || ' ' || coalesce(u.email,'') || ' ' || coalesce(s.id::text,'') || ' ' || coalesce(s.status,'')) ILIKE $1 ESCAPE '\\' ORDER BY s.created_at DESC LIMIT 4`,
    path: "/admin/workspaces/verification",
  },
  {
    group: "Inquiries",
    permission: "communications:manage",
    sql: `SELECT id::text id,subject title,status summary FROM tpa.inquiries WHERE ((coalesce(subject,'') || ' ' || coalesce(message,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' OR tags::text ILIKE $1) ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/crm",
  },
  {
    group: "Inbox",
    permission: "communications:manage",
    sql: `SELECT id::text id,subject title,correspondent summary FROM tpa.email_conversations WHERE ((coalesce(subject,'') || ' ' || coalesce(correspondent,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' OR EXISTS(SELECT 1 FROM tpa.email_messages m WHERE m.conversation_id=tpa.email_conversations.id AND m.body ILIKE $1)) ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/communications",
    parameter: "conversation",
  },
  {
    group: "Campaigns",
    permission: "communications:manage",
    sql: `SELECT id::text id,name title,subject summary FROM tpa.campaign_drafts WHERE (coalesce(name,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(body,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/communications",
    parameter: "campaign",
  },
  {
    group: "Content",
    permission: "content:publish",
    sql: `SELECT id::text id,coalesce(draft->>'title',slug) title,slug summary FROM tpa.content_entries WHERE ((coalesce(slug,'') || ' ' || coalesce(draft->>'title','') || ' ' || coalesce(draft->>'summary','') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' OR draft->>'intro' ILIKE $1 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(draft->'sections','[]')) section WHERE section->>'text' ILIKE $1 OR section->>'title' ILIKE $1)) ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/content/",
  },
  {
    group: "Events",
    permission: "events:manage",
    sql: `SELECT id::text id,title,location summary FROM tpa.events WHERE (coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' ORDER BY starts_at DESC LIMIT 4`,
    path: "/admin/workspaces/events",
  },
  {
    group: "Media",
    permission: "content:publish",
    sql: `SELECT id::text id,title,category summary FROM tpa.public_media WHERE (coalesce(title,'') || ' ' || coalesce(alt_text,'') || ' ' || coalesce(category,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT 4`,
    path: "/admin/workspaces/media",
  },
  {
    group: "Documents",
    permission: "documents:review",
    sql: `SELECT d.id::text id,concat(d.kind,' · ',u.name) title,u.email summary FROM tpa.private_documents d JOIN public."user" u ON u.id=d.owner_user_id WHERE (coalesce(d.kind,'') || ' ' || coalesce(d.id::text,'') || ' ' || coalesce(u.name,'') || ' ' || coalesce(u.email,'')) ILIKE $1 ESCAPE '\\' ORDER BY d.created_at DESC LIMIT 4`,
    path: "/api/documents/",
  },
  {
    group: "Bulk imports",
    permission: "staff:manage",
    sql: `SELECT id::text id,'Onboarding batch' title,created_at::text summary FROM tpa.onboarding_batches WHERE id::text ILIKE $1 ESCAPE '\\' AND actor_id=$2 ORDER BY created_at DESC LIMIT 4`,
    path: "/admin/workspaces/onboarding",
    owned: true,
  },
];
searchSources.push({
  group: "Governance",
  permission: "content:publish",
  alternativePermission: "members:review",
  sql: `SELECT id::text id,coalesce(draft->>'name','Profile') title,coalesce(draft->>'organization','') summary FROM tpa.people WHERE (coalesce(draft->>'name','') || ' ' || coalesce(draft->>'organization','') || ' ' || coalesce(id::text,'')) ILIKE $1 ORDER BY id LIMIT 4`,
  path: "/admin/workspaces/governance",
});
searchSources.push(
  {
    group: "Email templates",
    permission: "communications:manage",
    sql: `SELECT id::text id,name title,subject summary FROM tpa.communication_templates WHERE (coalesce(name,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(body,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/communications",
    parameter: "template",
  },
  {
    group: "News sources",
    permission: "content:publish",
    sql: `SELECT id::text id,name title,url summary FROM tpa.news_sources WHERE (coalesce(name,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(url,'') || ' ' || coalesce(id::text,'')) ILIKE $1 ORDER BY updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/content",
    parameter: "source",
  },
  {
    group: "Flyers",
    permission: "events:manage",
    sql: `SELECT e.id::text id,e.title,'Saved event flyer'::text summary FROM tpa.flyer_templates f JOIN tpa.events e ON e.id=f.event_id WHERE e.status='published' AND concat_ws(' ',e.title,f.speakers::text,e.id) ILIKE $1 ORDER BY f.updated_at DESC LIMIT 4`,
    path: "/admin/workspaces/flyers",
  },
);

export function permittedSearchSources(roles: string[]) {
  return searchSources.filter(
    (s) =>
      hasPermission(roles, s.permission) ||
      (!!s.alternativePermission &&
        hasPermission(roles, s.alternativePermission)),
  );
}
export function searchPattern(q: string) {
  return "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
}
