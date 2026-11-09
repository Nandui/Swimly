import "server-only";
import { notFound } from "next/navigation";
import { today, toDateOnlyString } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { previousSemester, semesterOf, STRIKE_OWNER, type StrikeCause, type StrikeStage } from "@/modules/staffing/shared/rules";
import { pickSite, poolStaff } from "@/modules/staffing/shared/server";

/** Strikes at a site (BR-8): the conversations and referrals still to do, soonest first, then this
 *  semester's strikes by person. Disciplinary records, so Run at the site is needed to see them. */
export async function strikesPage(siteId: string | undefined, semesterKey: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  if (!(await mayFor("staffing.run", { siteId: site.id, orgId: who.orgId ?? undefined }))) notFound();
  const day = today();
  const current = semesterOf(day);
  const semester = semesterKey && /^\d{4}-(01|05|09)$/.test(semesterKey) ? semesterKey : current.key;
  const [rows, people] = await Promise.all([
    prisma.staffingStrike.findMany({ where: { siteId: site.id, OR: [{ semester }, { handledAt: null, withdrawnAt: null }] }, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }] }),
    poolStaff(who.orgId),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const strikes = rows.map((s) => ({
    id: s.id, userId: s.userId, name: names.get(s.userId) ?? "Someone", semester: s.semester, number: s.number, cause: s.cause as StrikeCause, stage: s.stage as StrikeStage,
    counted: s.counted, occurredOn: toDateOnlyString(s.occurredOn), dueOn: toDateOnlyString(s.dueOn), handledAt: s.handledAt, handledByName: s.handledByName, note: s.note,
    signedByBoth: s.signedByBoth, withdrawn: !!s.withdrawnAt, owner: STRIKE_OWNER[s.stage as StrikeStage],
  }));
  const todo = strikes.filter((s) => !s.handledAt && !s.withdrawn && s.stage !== "not_counted").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const byPerson = new Map<string, { userId: string; name: string; counted: number; strikes: typeof strikes }>();
  for (const s of strikes.filter((x) => x.semester === semester)) {
    const row = byPerson.get(s.userId) ?? { userId: s.userId, name: s.name, counted: 0, strikes: [] };
    row.strikes.push(s);
    if (s.counted && !s.withdrawn) row.counted += 1;
    byPerson.set(s.userId, row);
  }
  const semesters = [current.key, previousSemester(current.key)];
  const allowed = { run: site.run, supervise: site.supervise, manage: site.manage };
  return {
    who, sites, site, today: day, semester, semesterLabel: semesterOf(`${semester}-01`).label, semesters,
    todo, people: [...byPerson.values()].sort((a, b) => b.counted - a.counted || a.name.localeCompare(b.name)), allowed,
  };
}
export type StrikesPage = NonNullable<Awaited<ReturnType<typeof strikesPage>>>;
