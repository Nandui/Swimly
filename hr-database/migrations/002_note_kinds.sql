-- Kinds on notes, and reports from managers on duty (D22). Additive only.
SET search_path = turnfin_hr;

-- What a note is about. Notes written before kinds are General.
ALTER TABLE notes ADD COLUMN kind text NOT NULL DEFAULT 'general'
  CHECK (kind IN ('general', 'conduct', 'performance', 'attendance', 'safety'));

-- How it was filed: on the file, or through the quick report form. A report
-- is always on the record (never private, never shared with the person),
-- names when it happened and the reporter's working site, and waits for a
-- reader there until `first_read_at`.
ALTER TABLE notes ADD COLUMN via text NOT NULL DEFAULT 'file' CHECK (via IN ('file', 'report'));
ALTER TABLE notes ADD COLUMN occurred_at timestamptz;
ALTER TABLE notes ADD COLUMN site_id text;
ALTER TABLE notes ADD COLUMN first_read_at timestamptz;
ALTER TABLE notes ADD COLUMN first_read_by text;
ALTER TABLE notes ADD CONSTRAINT notes_report_shape
  CHECK (via = 'file' OR (visibility = 'record' AND occurred_at IS NOT NULL AND site_id IS NOT NULL));

CREATE INDEX notes_unread_reports_idx ON notes (org_id, site_id) WHERE via = 'report' AND first_read_at IS NULL AND withdrawn_at IS NULL;
