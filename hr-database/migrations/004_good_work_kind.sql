-- A positive kind of note and report: Good work (D22, 4 November 2026). Additive only.
SET search_path = turnfin_hr;

ALTER TABLE notes DROP CONSTRAINT notes_kind_check;
ALTER TABLE notes ADD CONSTRAINT notes_kind_check
  CHECK (kind IN ('general', 'conduct', 'performance', 'attendance', 'safety', 'good_work'));
