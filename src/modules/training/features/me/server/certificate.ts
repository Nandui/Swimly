import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { newCertificateCode } from "@/modules/training/shared/certificates";

/** The signed-in person's certificate for training they finished (e-learning
 *  phase 4), for Turnfin Me to show and print. Its code is made the first time
 *  it is shown and never changes; a trainer checks it in Training. Null when
 *  the training isn't theirs or isn't finished. */
export async function myCertificate(user: { id: string; name: string }, id: string) {
  const select = { id: true, completedAt: true, signedOffByName: true, certificateCode: true, versionId: true,
    course: { select: { title: true, summary: true, grantsTypeId: true } } } as const;
  let row = await prisma.trainingAssignment.findFirst({ where: { id, userId: user.id, status: "COMPLETED" }, select });
  if (!row) return null;
  for (let tries = 0; !row.certificateCode && tries < 3; tries++) {
    try { await prisma.trainingAssignment.updateMany({ where: { id, certificateCode: null }, data: { certificateCode: newCertificateCode() } }); }
    catch { /* a clash with another code: try another */ }
    row = (await prisma.trainingAssignment.findFirst({ where: { id }, select }))!;
  }
  const [type, version] = await Promise.all([
    row.course.grantsTypeId ? qualificationTypesByIds([row.course.grantsTypeId]).then((m) => m.get(row!.course.grantsTypeId!) ?? null) : null,
    row.versionId ? prisma.trainingCourseVersion.findUnique({ where: { id: row.versionId }, select: { number: true } }) : null,
  ]);
  return { name: user.name, course: row.course.title, summary: row.course.summary, completedAt: row.completedAt!, signedOffBy: row.signedOffByName,
    grants: type?.name ?? null, version: version?.number ?? null, code: row.certificateCode };
}
