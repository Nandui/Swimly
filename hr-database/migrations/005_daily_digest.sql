-- The daily email of yesterday's reports (owner request, 9 November 2026:
-- "a report of all done on the previous day per staff so I am always aware").
-- Additive only.
SET search_path = turnfin_hr;

-- HR's own settings, one row per organisation. `digest_to`: the addresses the
-- daily email goes to, comma separated; empty sends nothing. Superadmins set it.
CREATE TABLE settings (
  org_id text PRIMARY KEY,
  digest_to text NOT NULL DEFAULT '',
  changed_by_id text NOT NULL,
  changed_by_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per organisation and Dublin day once that day's email is claimed, so
-- the job sends each day once however often it runs. Keeps the outcome.
CREATE TABLE digest_runs (
  org_id text NOT NULL,
  day date NOT NULL,
  reports int NOT NULL DEFAULT 0,
  sent_to text NOT NULL DEFAULT '',
  error text,
  ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, day)
);

CREATE INDEX notes_reports_filed_idx ON notes (org_id, created_at) WHERE via = 'report';
