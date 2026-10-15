import "server-only";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { FILE_SELECT, fileProblem, MAX_FILE_BYTES, safeFileName } from "@/modules/training/shared/files";

/** Adding a file to a course, and opening one in Work. Files are never deleted:
 *  a published version may still show them. */

export class TrainingFileError extends Error {}
export { MAX_FILE_BYTES };

export async function addCourseFile(courseId: string, file: File) {
  const who = await requireTrainingActor();
  if (!who.manage || !who.orgId) throw new TrainingFileError("Adding files needs the Author level in Training.");
  if (file.size > MAX_FILE_BYTES) throw new TrainingFileError("Files must be no larger than 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const problem = fileProblem(file, bytes);
  if (problem) throw new TrainingFileError(problem);
  const name = safeFileName(file.name);
  return prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId! }, select: { title: true } });
    if (!course) throw new TrainingFileError("That course no longer exists.");
    const row = await tx.trainingFile.create({ data: { courseId, name, mime: file.type, size: bytes.length, bytes, addedById: who.id, addedByName: who.name }, select: { id: true, name: true, mime: true, size: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingCourse", entityId: courseId, summary: `Added the file ${name} to ${course.title}` }, tx);
    return row;
  });
}

/** Anyone in the Training workspace may open a course's files: course material
 *  is organisation data, like the catalogue. */
export async function readCourseFile(fileId: string) {
  const who = await requireTrainingActor();
  return prisma.trainingFile.findFirst({ where: { id: fileId, course: { orgId: who.orgId ?? undefined } }, select: FILE_SELECT });
}
