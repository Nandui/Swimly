-- D23: HR moves into the main database. Records the one-time copy from the
-- separate HR database, so it runs once and never from a different source.
SET search_path = turnfin_hr;

CREATE TABLE storage_imports (
  id text PRIMARY KEY,
  source text NOT NULL,
  counts jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
