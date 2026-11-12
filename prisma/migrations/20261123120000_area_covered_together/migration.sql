-- Staff in another area covering this one while both are open (Admin, Areas). Additive.
ALTER TABLE "SiteArea" ADD COLUMN IF NOT EXISTS "together" JSONB;
