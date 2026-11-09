-- The daily reports email, by the person's main site (owner request, 9 November
-- 2026: "The email lists it goes to, depends on the staff's main site").
-- Site id to "a@x, b@y". `digest_to` stays the list for every site. Additive only.
SET search_path = turnfin_hr;

ALTER TABLE settings ADD COLUMN digest_to_by_site jsonb NOT NULL DEFAULT '{}'::jsonb;
