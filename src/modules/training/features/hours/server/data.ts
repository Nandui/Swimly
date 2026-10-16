import "server-only";
import { activeStaffWithRoles } from "@/lib/directory";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { qualificationTypesByIds, qualificationTypesOf } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { hoursProgress } from "@/modules/training/shared/on-the-job";
import { progressFor } from "@/modules/training/shared/on-the-job-reads";

/** In-service hours for the Training workspace (phase 5): each qualification's
 *  target against the people holding it, and the log. Limited to the people
 *  the viewer's Training records reach. */

export async function hoursOverview() {
  const who = await requireTrainingActor();
  const on = parseDateOnly(today());
  const [reach, signoffScope] = await Promise.all([subjectsFor("training.records.read"), subjectsFor("training.signoff")]);
  const staff = await activeStaffWithRoles(who.orgId ?? null, reach);
  const ids = staff.map((s) => s.id);
  const [{ targets, held, entries }, types, log] = await Promise.all([
    progressFor(who.orgId, ids, on),
    qualificationTypesOf(who.orgId),
    prisma.trainingHours.findMany({ where: { orgId: who.orgId ?? undefined, removedAt: null, userId: { in: ids } }, orderBy: [{ on: "desc" }, { createdAt: "desc" }], take: 60,
      select: { id: true, userId: true, typeId: true, on: true, minutes: true, topic: true, sessionId: true, recordedByName: true } }),
  ]);
  const typeNames = await qualificationTypesByIds([...targets.map((t) => t.typeId), ...log.map((l) => l.typeId)]);
  const name = new Map(staff.map((s) => [s.id, s]));
  const summaries = targets.map((t) => {
    const rows = held.filter((h) => h.typeId === t.typeId).map((h) => ({
      userId: h.userId, name: name.get(h.userId)?.name ?? "Former staff", jobTitle: name.get(h.userId)?.jobTitle ?? null,
      ...hoursProgress(entries.filter((e) => e.userId === h.userId && e.typeId === t.typeId), t, on),
    })).sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
    return { typeId: t.typeId, typeName: typeNames.get(t.typeId)?.name ?? "Removed qualification", hours: t.hours, windowMonths: t.windowMonths, rows, met: rows.filter((r) => r.met).length };
  }).sort((a, b) => a.typeName.localeCompare(b.typeName));
  return {
    who, summaries,
    types: types.map((t) => ({ id: t.id, name: t.name, target: targets.find((x) => x.typeId === t.id) ?? null })),
    log: log.map((l) => ({ ...l, name: name.get(l.userId)?.name ?? "Former staff", typeName: l.typeId ? typeNames.get(l.typeId)?.name ?? "Removed qualification" : null,
      canRemove: who.signoff && l.userId !== who.id && filterAllows(signoffScope, l.userId) })),
    loggable: who.signoff ? staff.filter((s) => s.id !== who.id && filterAllows(signoffScope, s.id)) : [],
  };
}
