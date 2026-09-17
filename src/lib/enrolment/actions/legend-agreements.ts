"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { agreementRecord } from "@/lib/enrolment/legend-agreement";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { fullName } from "@/lib/students/constants";
import { courseLabelWithSite } from "@/lib/courses/constants";

export async function confirmLegendAgreement(id: string): Promise<ActionResult> {
  const actor = await requirePermission("enrolment.manage");
  if (typeof id !== "string" || !id || id.length > 100) return fail("Choose an enrolment to confirm.");
  const clubId = await currentClubId();
  const source = await prisma.enrolment.findUnique({ where: { id, course: { clubId } }, select: { courseId: true } });
  if (!source) return fail("That enrolment is not at this site. Refresh the list.");
  const result = await withCourseSeat(source.courseId, async tx => {
    const row = await tx.enrolment.findUnique({ where: { id, course: { clubId } }, select: {
      id: true, status: true, programmeId: true, legendAgreementStatus: true,
      student: { select: { firstName: true, lastName: true } },
      course: { select: { name: true, dayOfWeek: true, startMinutes: true, level: { select: { name: true } }, club: { select: { name: true } } } },
    } });
    if (!row || row.status !== "ACTIVE") return fail("That place has ended or moved. Refresh the list before confirming.");
    if (row.legendAgreementStatus === "DONE") return ok();
    await tx.enrolment.update({ where: { id }, data: agreementRecord("DONE", actor.user) });
    await logAudit({ actorId: actor.user.id, actorName: actor.user.name ?? "Unknown", action: "legend-agreement",
      entity: "Enrolment", entityId: id, programmeId: row.programmeId, clubId,
      summary: `Confirmed the Legend billing agreement is updated for ${fullName(row.student)} in ${courseLabelWithSite(row.course)}`,
    }, tx);
    return ok();
  });
  if (result.ok) {
    revalidatePath("/legend-agreements");
    revalidatePath("/students/[id]", "page");
    revalidatePath("/courses/[id]", "page");
  }
  return result;
}
