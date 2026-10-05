-- Rota: the dates a repeating booking does not run (a bank holiday, a school's mid-term break).
-- Additive only: one column with an empty default.

ALTER TABLE "RotaBooking" ADD COLUMN "skipDates" DATE[] NOT NULL DEFAULT ARRAY[]::DATE[];
