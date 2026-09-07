ALTER TABLE "Programme" ADD COLUMN "imageData" BYTEA, ADD COLUMN "imageVersion" TEXT;
ALTER TABLE "Level" ADD COLUMN "imageData" BYTEA, ADD COLUMN "imageVersion" TEXT;
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_image_size" CHECK (octet_length("imageData") <= 262144);
ALTER TABLE "Level" ADD CONSTRAINT "Level_image_size" CHECK (octet_length("imageData") <= 262144);
