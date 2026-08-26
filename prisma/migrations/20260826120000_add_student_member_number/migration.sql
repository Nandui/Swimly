-- The club's own identifier for a swimmer, carried over from the system this
-- data came from. Nullable, because a swimmer added in Swimly first has no
-- number yet; unique, so a re-import matches an existing child rather than
-- creating a second one, and so a mistyped digit collides loudly.
--
-- Postgres treats NULLs as distinct in a unique index, so the existing rows
-- without a number do not conflict with each other.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "memberNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_memberNumber_key" ON "Student"("memberNumber");
