-- Owner decision, 9 October 2026: on a certificate only the expiry date is mandatory; the issue
-- date is kept when known. Relaxing NOT NULL is additive: every existing row keeps its date.
ALTER TABLE "Qualification" ALTER COLUMN "issuedOn" DROP NOT NULL;
