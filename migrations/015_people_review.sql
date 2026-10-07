CREATE TABLE tpa.profile_groups (
 id UUID PRIMARY KEY, parent_id UUID REFERENCES tpa.profile_groups(id),
 draft JSONB NOT NULL, published JSONB, archived BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(parent_id IS NULL OR parent_id<>id)
);
INSERT INTO tpa.profile_groups(id,draft,published) VALUES
 ('11111111-1111-4111-8111-111111111111','{"name":"Executive Committee","page":"governance","section":0,"order":0}','{"name":"Executive Committee","page":"governance","section":0,"order":0}'),
 ('22222222-2222-4222-8222-222222222222','{"name":"Sub-Committee","page":"governance","section":1,"order":1}','{"name":"Sub-Committee","page":"governance","section":1,"order":1}'),
 ('33333333-3333-4333-8333-333333333333','{"name":"Founding Members","page":"about","section":2,"order":2}','{"name":"Founding Members","page":"about","section":2,"order":2}');
CREATE TABLE tpa.people (
 id UUID PRIMARY KEY, user_id TEXT UNIQUE REFERENCES public."user"(id) ON DELETE CASCADE,
 legacy_governance_id UUID UNIQUE REFERENCES tpa.governance_profiles(id),
 accepted JSONB NOT NULL, draft JSONB NOT NULL, published JSONB,
 status TEXT NOT NULL DEFAULT 'unverified' CHECK(status IN ('unverified','pending','verified','rejected')),
 accepted_verified BOOLEAN NOT NULL DEFAULT false, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.person_revisions (
 id UUID PRIMARY KEY, person_id UUID NOT NULL REFERENCES tpa.people(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, action TEXT NOT NULL, body JSONB NOT NULL,
 actor_id TEXT REFERENCES public."user"(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.profile_reviews (
 id UUID PRIMARY KEY, person_id UUID NOT NULL REFERENCES tpa.people(id) ON DELETE CASCADE,
 body JSONB NOT NULL, baseline JSONB NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','superseded')),
 proposed_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
 reviewed_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL, reason TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX profile_one_pending ON tpa.profile_reviews(person_id) WHERE status='pending';
CREATE TABLE tpa.person_assignments (
 person_id UUID NOT NULL REFERENCES tpa.people(id) ON DELETE CASCADE,
 group_id UUID NOT NULL REFERENCES tpa.profile_groups(id), role TEXT NOT NULL, term TEXT NOT NULL,
 display_order INTEGER NOT NULL CHECK(display_order BETWEEN 0 AND 999), PRIMARY KEY(person_id,group_id)
);
CREATE TABLE tpa.profile_portraits (
 id UUID PRIMARY KEY, person_id UUID NOT NULL REFERENCES tpa.people(id) ON DELETE CASCADE,
 alt_text TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 byte_size INTEGER NOT NULL, uploaded_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tpa.people(id,legacy_governance_id,accepted,draft,published,version)
SELECT id,id,
 draft - 'group' - 'role' - 'committee' - 'term' - 'order' || jsonb_build_object('assignments',jsonb_build_array(jsonb_build_object('groupId',CASE draft->>'group' WHEN 'executive' THEN '11111111-1111-4111-8111-111111111111' WHEN 'subcommittee' THEN '22222222-2222-4222-8222-222222222222' ELSE '33333333-3333-4333-8333-333333333333' END,'role',draft->>'role','term',coalesce(draft->>'term',''),'order',coalesce((draft->>'order')::int,0)))) AS accepted,
 draft - 'group' - 'role' - 'committee' - 'term' - 'order' || jsonb_build_object('assignments',jsonb_build_array(jsonb_build_object('groupId',CASE draft->>'group' WHEN 'executive' THEN '11111111-1111-4111-8111-111111111111' WHEN 'subcommittee' THEN '22222222-2222-4222-8222-222222222222' ELSE '33333333-3333-4333-8333-333333333333' END,'role',draft->>'role','term',coalesce(draft->>'term',''),'order',coalesce((draft->>'order')::int,0)))) AS draft,
 CASE WHEN published IS NOT NULL THEN published - 'group' - 'role' - 'committee' - 'term' - 'order' || jsonb_build_object('assignments',jsonb_build_array(jsonb_build_object('groupId',CASE published->>'group' WHEN 'executive' THEN '11111111-1111-4111-8111-111111111111' WHEN 'subcommittee' THEN '22222222-2222-4222-8222-222222222222' ELSE '33333333-3333-4333-8333-333333333333' END,'role',published->>'role','term',coalesce(published->>'term',''),'order',coalesce((published->>'order')::int,0)))) END,
 version FROM tpa.governance_profiles;
INSERT INTO tpa.person_assignments SELECT p.id,(a->>'groupId')::uuid,a->>'role',a->>'term',(a->>'order')::int FROM tpa.people p CROSS JOIN LATERAL jsonb_array_elements(p.accepted->'assignments') a;
INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id,created_at)
SELECT gen_random_uuid(),profile_id,version,'legacy.'||action,body,actor_id,created_at FROM tpa.governance_revisions;
INSERT INTO tpa.people(id,user_id,accepted,draft)
SELECT gen_random_uuid(),u.id,
 jsonb_build_object('name',u.name,'phone',coalesce(p.phone,''),'organization',coalesce(p.organization,''),'profession',coalesce(p.profession,''),'jobTitle',coalesce(p.job_title,''),'city',coalesce(p.city,''),'biography','','links','[]'::jsonb,'assignments','[]'::jsonb),
 jsonb_build_object('name',u.name,'phone',coalesce(p.phone,''),'organization',coalesce(p.organization,''),'profession',coalesce(p.profession,''),'jobTitle',coalesce(p.job_title,''),'city',coalesce(p.city,''),'biography','','links','[]'::jsonb,'assignments','[]'::jsonb)
 FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id;
