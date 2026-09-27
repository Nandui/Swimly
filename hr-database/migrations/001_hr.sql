-- Turnfin HR and performance: a separate database, like Docs. It stores only
-- ids and the names needed to read a record later; identity, the organisation
-- chart and who may see what stay in the main Turnfin database and its policy
-- engine. Every table carries org_id and the subject's user id.

CREATE SCHEMA IF NOT EXISTS turnfin_hr;
SET search_path = turnfin_hr;

-- Notes about a person. `private`: the author (and superadmins) only.
-- `record`: anyone who may read this person's HR record. `subject`: also shown
-- to the person themselves.
CREATE TABLE notes (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  subject_user_id text NOT NULL,
  author_id text NOT NULL,
  author_name text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private', 'record', 'subject')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_reason text NOT NULL DEFAULT ''
);
CREATE INDEX notes_subject_idx ON notes (org_id, subject_user_id, created_at DESC);

-- Performance reviews. A draft is the reviewer's to edit; sharing locks it and
-- shows it to the person, who can add a comment and acknowledge it.
CREATE TABLE reviews (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  subject_user_id text NOT NULL,
  reviewer_id text NOT NULL,
  reviewer_name text NOT NULL,
  period text NOT NULL CHECK (length(period) BETWEEN 2 AND 80),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'acknowledged')),
  summary text NOT NULL DEFAULT '',
  strengths text NOT NULL DEFAULT '',
  goals text NOT NULL DEFAULT '',
  overall text CHECK (overall IS NULL OR overall IN ('exceeds', 'meets', 'developing')),
  subject_comment text NOT NULL DEFAULT '',
  shared_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR shared_at IS NOT NULL),
  CHECK (status <> 'acknowledged' OR acknowledged_at IS NOT NULL)
);
CREATE INDEX reviews_subject_idx ON reviews (org_id, subject_user_id, created_at DESC);

-- Who read whose HR record, and why. Written on every restricted read.
CREATE TABLE access_events (
  id bigserial PRIMARY KEY,
  org_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  subject_user_ids text[] NOT NULL,
  entity text NOT NULL,
  entity_id text,
  purpose text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_events_at_idx ON access_events (org_id, at DESC);
CREATE INDEX access_events_subject_idx ON access_events USING gin (subject_user_ids);

-- Every change, in the same transaction as the change.
CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  org_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  subject_user_id text NOT NULL,
  summary text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_at_idx ON audit_events (org_id, at DESC);
