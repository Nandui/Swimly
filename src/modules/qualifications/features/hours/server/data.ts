import "server-only";
import { activeStaffWithRoles } from "@/lib/directory";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { qualificationTypesByIds, qualificationTypesOf } from "@/lib/qualifications";
import { requireQualificationsActor } from "@/modules/qualifications/shared/access";
import { hoursProgress } from "@/modules/qualifications/shared/hours";
import { progressFor } from "@/modules/qualifications/shared/hours-reads";

/** In-service hours: each qualification's target against the people holding it, and the log.
 *  Limited to the people the viewer's `qualifications.manage` covers. */

export async function hoursOverview() {
  const who = await requireQualificationsActor();
  const on = parseDateOnly(today());
  const reach = await subjectsFor("qualifications.manage");
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
      canRemove: l.userId !== who.id && filterAllows(reach, l.userId) })),
    loggable: staff.filter((s) => s.id !== who.id),
  };
}
