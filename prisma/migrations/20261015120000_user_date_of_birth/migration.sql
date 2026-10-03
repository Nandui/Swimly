-- A date of birth on the person record, optional (docs/rota.md, Breaks).
-- Additive: one nullable column.
ALTER TABLE "User" ADD COLUMN "dateOfBirth" DATE;
