import "server-only";
import { staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { readCertificateCode } from "@/modules/training/shared/certificates";

/** Checks a certificate code from Turnfin Me (e-learning phase 4): whose it is,
 *  for which course and when it was finished, and whether it still stands
 *  (training is never deleted, so a code always finds its record). Anyone with
 *  Training access may check one; it shows nothing else about the person. */
export async function checkCertificate(raw: string) {
  await requireTrainingActor();
  const code = readCertificateCode(raw);
  if (!code) return { found: false as const, code: raw.trim().slice(0, 20) };
  const row = await prisma.trainingAssignment.findUnique({ where: { certificateCode: code }, select: {
    userId: true, status: true, completedAt: true, signedOffByName: true, course: { select: { title: true } },
  } });
  if (!row) return { found: false as const, code };
  const person = (await staffByIds([row.userId])).get(row.userId);
  return { found: true as const, code, name: person?.name ?? "Former staff", course: row.course.title, completedAt: row.completedAt, signedOffBy: row.signedOffByName, standing: row.status === "COMPLETED" };
}
