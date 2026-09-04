-- A class conducted, on one date, by somebody other than its instructor.
-- Written when the cover confirms they are taking the class, so the register
-- records who actually stood at the pool and whose class it was.

-- CreateTable
CREATE TABLE "ClassCover" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "coverById" TEXT,
    "coverByName" TEXT NOT NULL,
    "instructorId" TEXT,
    "instructorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassCover_courseId_date_key" ON "ClassCover"("courseId", "date");

-- CreateIndex
CREATE INDEX "ClassCover_coverById_date_idx" ON "ClassCover"("coverById", "date");

-- AddForeignKey
ALTER TABLE "ClassCover"
    ADD CONSTRAINT "ClassCover_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCover"
    ADD CONSTRAINT "ClassCover_coverById_fkey"
    FOREIGN KEY ("coverById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCover"
    ADD CONSTRAINT "ClassCover_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
