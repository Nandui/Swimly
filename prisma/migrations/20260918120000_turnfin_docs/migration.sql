-- Additive Docs workspace; shared Turnfin staff identities. No demo data.
CREATE SCHEMA turnfin_docs;
SET search_path = turnfin_docs, public;
CREATE TABLE IF NOT EXISTS workspace_lock (id integer PRIMARY KEY);
INSERT INTO workspace_lock VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE member_profiles (id text PRIMARY KEY REFERENCES public."User"(id), facility_ids text[] NOT NULL DEFAULT '{}', team_ids text[] NOT NULL DEFAULT '{}');
CREATE VIEW members AS SELECT u.id, u.name, u.email, coalesce(r.name, '') AS role,
 (u."isActive" AND r.id IS NOT NULL) AS active, coalesce(r.permissions, '{}') AS permissions,
 coalesce(r.screens, '{}') AS screens, coalesce(p.facility_ids, '{}') AS facility_ids, coalesce(p.team_ids, '{}') AS team_ids
 FROM public."User" u LEFT JOIN public."StaffRole" r ON r.id=u."staffRoleId" LEFT JOIN member_profiles p ON p.id=u.id;
CREATE TABLE IF NOT EXISTS groups (id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('facility','team')), name text NOT NULL, UNIQUE(kind,name));
CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS templates (id text PRIMARY KEY, type text NOT NULL, name text NOT NULL, body jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL REFERENCES public."User"(id),
  archived_at timestamptz, archive_reason text, current_version_id text,
  search_text text NOT NULL DEFAULT '', search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english',search_text)) STORED
);
CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING gin(search_vector);
CREATE TABLE IF NOT EXISTS snapshots (
  id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents,
  version integer, kind text NOT NULL CHECK(kind IN ('submission','publication')),
  content jsonb NOT NULL, contributors text[] NOT NULL, change_summary text NOT NULL,
  author_id text NOT NULL REFERENCES public."User"(id), approver_id text REFERENCES public."User"(id), submission_id text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,version),
  CHECK((kind='submission' AND version IS NULL) OR (kind='publication' AND version>0))
);
CREATE TABLE IF NOT EXISTS drafts (
  document_id text PRIMARY KEY REFERENCES documents, revision integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','changes_requested','in_review')),
  content jsonb NOT NULL, contributors text[] NOT NULL,
  change_summary text NOT NULL DEFAULT '', approver_id text REFERENCES public."User"(id),
  submission_id text REFERENCES snapshots, feedback text NOT NULL DEFAULT '',
  lease_owner text REFERENCES public."User"(id), lease_session text, lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY, submission_id text UNIQUE NOT NULL REFERENCES snapshots,
  reviewer_id text NOT NULL REFERENCES public."User"(id), decision text NOT NULL CHECK(decision IN ('approved','changes_requested')),
  feedback text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assignment_rules (document_id text PRIMARY KEY REFERENCES documents, member_ids text[] NOT NULL DEFAULT '{}', team_ids text[] NOT NULL DEFAULT '{}', due_date date);
CREATE TABLE IF NOT EXISTS requirements (
  id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents, version_id text NOT NULL REFERENCES snapshots,
  member_id text NOT NULL REFERENCES public."User"(id), status text NOT NULL DEFAULT 'outstanding' CHECK(status IN ('outstanding','completed','cancelled')),
  due_date date, UNIQUE(version_id, member_id)
);
CREATE TABLE IF NOT EXISTS acknowledgements (id text PRIMARY KEY, version_id text NOT NULL REFERENCES snapshots, member_id text NOT NULL REFERENCES public."User"(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(version_id,member_id));
CREATE TABLE IF NOT EXISTS audit_events (id text PRIMARY KEY, actor_id text NOT NULL REFERENCES public."User"(id), document_id text REFERENCES documents, action text NOT NULL, detail text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS attachments (id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents, name text NOT NULL, mime text NOT NULL, size integer NOT NULL CHECK(size>0), storage_key text UNIQUE NOT NULL, created_by text NOT NULL REFERENCES public."User"(id));

CREATE OR REPLACE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Historical records are immutable'; END $$;
DROP TRIGGER IF EXISTS snapshots_immutable ON snapshots;
CREATE TRIGGER snapshots_immutable BEFORE UPDATE OR DELETE ON snapshots FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
DROP TRIGGER IF EXISTS reviews_immutable ON reviews;
CREATE TRIGGER reviews_immutable BEFORE UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
DROP TRIGGER IF EXISTS acknowledgements_immutable ON acknowledgements;
CREATE TRIGGER acknowledgements_immutable BEFORE UPDATE OR DELETE ON acknowledgements FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
DROP TRIGGER IF EXISTS audit_immutable ON audit_events;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
DROP TRIGGER IF EXISTS attachments_immutable ON attachments;
CREATE TRIGGER attachments_immutable BEFORE UPDATE OR DELETE ON attachments FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_lock ENABLE ROW LEVEL SECURITY;
-- There are no public API policies. Writes use the authenticated,
-- server-only domain service and a database transaction. Private tables default deny.

CREATE TABLE attachment_blobs (id text PRIMARY KEY REFERENCES attachments(id), bytes bytea NOT NULL);
ALTER TABLE attachment_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER attachment_blobs_immutable BEFORE UPDATE OR DELETE ON attachment_blobs FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
INSERT INTO templates (id,type,name,body) SELECT 'default-' || lower(replace(t,' ','-')),t,t || ' template','{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb FROM unnest(ARRAY['SOP','NOP','EAP','Risk assessment','Policy','Custom']) AS t;
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Purpose and scope"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Responsibilities"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Before you begin"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Procedure"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Records and related documents"}]},{"type":"paragraph"}]}'::jsonb WHERE type='SOP';
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Purpose and scope"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Responsibilities"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Before you begin"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Procedure"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Records and related documents"}]},{"type":"paragraph"}]}'::jsonb WHERE type='NOP';
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Purpose and scope"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Immediate actions"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Roles and responsibilities"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Communications"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recovery and review"}]},{"type":"paragraph"}]}'::jsonb WHERE type='EAP';
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Activity and scope"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"People involved"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Assessment notes"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Review arrangements"}]},{"type":"paragraph"}]}'::jsonb WHERE type='Risk assessment';
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Purpose"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Policy statement"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Responsibilities"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Implementation"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Review"}]},{"type":"paragraph"}]}'::jsonb WHERE type='Policy';
UPDATE templates SET body='{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Overview"}]},{"type":"paragraph"}]}'::jsonb WHERE type='Custom';
RESET search_path;
