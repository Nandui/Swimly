-- One organisation chart. Platform sites (facility) and departments (team)
-- appear in Docs as groups with the platform's own ids and source='platform';
-- their membership comes from each person's Staff profile, not from Docs.
-- Existing Docs-only groups keep source='docs' and stay editable here, because
-- published document versions reference them and must remain unchanged.
SET search_path = turnfin_docs;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'docs';
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_source_check;
ALTER TABLE groups ADD CONSTRAINT groups_source_check CHECK (source IN ('docs', 'platform'));
RESET search_path;
