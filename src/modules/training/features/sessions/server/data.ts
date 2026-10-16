import "server-only";
import { activeStaffWithRoles, organisationChart, staffCardsByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { qualificationTypesOf } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { sessionWhen, SESSION_ZONE } from "@/modules/training/shared/on-the-job";

/** Classroom and poolside sessions for the Training workspace (phase 5). The
 *  sessions themselves are organisation data; who is booked on one is limited
 *  to the people the viewer's Training records reach. */

const sessionSelect = {
  id: true, title: true, courseId: true, siteId: true, location: true, startsAt: true, minutes: true, capacity: true, trainerName: true, hoursTypeId: true, note: true,
  cancelledAt: true, registerClosedAt: true, registerClosedByName: true, createdByName: true, course: { select: { title: true } },
} as const;

const clock = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: SESSION_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: SESSION_ZONE }).format(d);

async function options(orgId: string | null) {
  const [chart, types, courses] = await Promise.all([
    organisationChart(),
    qualificationTypesOf(orgId),
    prisma.trainingCourse.findMany({ where: { orgId: orgId ?? undefined, archivedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return { sites: chart.sites, types: types.filter((t) => !t.archivedAt).map((t) => ({ id: t.id, name: t.name })), courses };
}

export async function listSessions() {
  const who = await requireTrainingActor();
  const reach = await subjectsFor("training.records.read");
  const rows = await prisma.trainingSession.findMany({
    where: { orgId: who.orgId ?? undefined },
    orderBy: { startsAt: "desc" },
    take: 200,
    select: { ...sessionSelect, places: { select: { status: true, userId: true } } },
  });
  const { sites, types, courses } = await options(who.orgId);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const now = Date.now();
  const shaped = rows.map((s) => {
    const mine = s.places.filter((p) => filterAllows(reach, p.userId));
    return {
      id: s.id, title: s.title, when: sessionWhen(s.startsAt, s.minutes), startsAt: s.startsAt, course: s.course?.title ?? null,
      where: [s.siteId ? siteName.get(s.siteId) ?? "Removed site" : null, s.location || null].filter(Boolean).join(", "),
      trainerName: s.trainerName, capacity: s.capacity, booked: s.places.length, yours: mine.length,
      state: s.cancelledAt ? "cancelled" as const : s.registerClosedAt ? "closed" as const : s.startsAt.getTime() + s.minutes * 60_000 < now ? "register" as const : "upcoming" as const,
    };
  });
  return {
    who, sites, types, courses,
    upcoming: shaped.filter((s) => s.state === "upcoming").reverse(),
    register: shaped.filter((s) => s.state === "register").reverse(),
    past: shaped.filter((s) => s.state === "closed" || s.state === "cancelled").slice(0, 50),
  };
}
export type SessionRow = Awaited<ReturnType<typeof listSessions>>["upcoming"][number];

export async function sessionDetail(sessionId: string) {
  const who = await requireTrainingActor();
  const s = await prisma.trainingSession.findFirst({ where: { id: sessionId, orgId: who.orgId ?? undefined }, select: {
    ...sessionSelect, places: { orderBy: { createdAt: "asc" }, select: { id: true, userId: true, status: true, addedByName: true, markedAt: true } },
  } });
  if (!s) return null;
  const [reach, signoffScope, assignScope, opts] = await Promise.all([
    subjectsFor("training.records.read"), subjectsFor("training.signoff"), subjectsFor("training.assign"), options(who.orgId),
  ]);
  const visible = s.places.filter((p) => filterAllows(reach, p.userId));
  const cards = await staffCardsByIds(visible.map((p) => p.userId));
  const assignable = who.assign ? await activeStaffWithRoles(who.orgId ?? null, assignScope) : [];
  const booked = new Set(s.places.map((p) => p.userId));
  const open = !s.cancelledAt && !s.registerClosedAt;
  const started = s.startsAt.getTime() <= Date.now();
  const registerOpen = open && s.startsAt.getTime() <= Date.now() + 60 * 60_000;
  const places = visible.map((p) => ({
    id: p.id, userId: p.userId, name: cards.get(p.userId)?.name ?? "Former staff", jobTitle: cards.get(p.userId)?.jobTitle ?? null,
    status: p.status as "BOOKED" | "ATTENDED" | "ABSENT", addedByName: p.addedByName,
    canMark: who.signoff && registerOpen && filterAllows(signoffScope, p.userId),
    canRemove: who.assign && open && p.status === "BOOKED" && filterAllows(assignScope, p.userId),
  }));
  const attended = s.places.filter((p) => p.status === "ATTENDED").map((p) => p.userId);
  const closeBlock = !open ? null
    : !started ? "The register can be closed once the session has started."
    : !s.places.length ? "Nobody is booked on it."
    : s.places.some((p) => p.status === "BOOKED") ? "Mark everyone as attended or absent first."
    : attended.some((id) => id === who.id || !filterAllows(signoffScope, id)) ? "Someone else has to close it: it includes you or people you can't sign off."
    : null;
  const siteName = s.siteId ? opts.sites.find((x) => x.id === s.siteId)?.name ?? "Removed site" : null;
  const typeName = s.hoursTypeId ? opts.types.find((t) => t.id === s.hoursTypeId)?.name ?? "Removed qualification" : null;
  return {
    who, ...opts,
    session: {
      id: s.id, title: s.title, courseId: s.courseId, course: s.course?.title ?? null, siteId: s.siteId, siteName, location: s.location,
      when: sessionWhen(s.startsAt, s.minutes), date: day(s.startsAt), start: clock(s.startsAt), minutes: s.minutes, capacity: s.capacity,
      trainerName: s.trainerName, hoursTypeId: s.hoursTypeId, typeName, note: s.note, createdByName: s.createdByName,
      cancelled: !!s.cancelledAt, closedAt: s.registerClosedAt, closedByName: s.registerClosedByName, open, registerOpen,
    },
    places, hidden: s.places.length - visible.length, booked: s.places.length,
    attended: s.places.filter((p) => p.status === "ATTENDED").length, absent: s.places.filter((p) => p.status === "ABSENT").length,
    assignable: assignable.filter((p) => !booked.has(p.id)),
    canClose: who.signoff && open, closeBlock,
  };
}

/** Sessions that have finished with the register still open, for the home page. */
export async function registersToClose() {
  const who = await requireTrainingActor();
  if (!who.signoff) return 0;
  return prisma.trainingSession.count({ where: { orgId: who.orgId ?? undefined, cancelledAt: null, registerClosedAt: null, startsAt: { lt: new Date() }, places: { some: {} } } });
}
