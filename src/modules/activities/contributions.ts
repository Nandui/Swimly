import "server-only";
import { prisma } from "@/lib/prisma";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";
import { registerHomeCard, registerSiteSummary, registerStaffColumn, type HomeItem } from "@/modules/contributions";
import { minutesNow, today } from "@/lib/format";
import { weekdayOfIso } from "@/modules/activities/lib/attendance/dates";
import { getCoversForDay } from "@/modules/activities/lib/attendance/data/cover";
import { getCancellationsForDay } from "@/modules/activities/lib/cancellations/data";
import { courseName, formatTime } from "@/modules/activities/lib/courses/constants";
import { getCoursesOnDay } from "@/modules/activities/lib/courses/data/courses";
import { getAwaitingEnrolment } from "@/modules/activities/lib/enrolment/data/awaiting-enrolment";
import { getTodayAssessments } from "@/modules/activities/lib/today/assessments";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IE")} ${n === 1 ? one : many}`;

/** Classes each person is the scheduled instructor for, archived ones included,
 *  as the Staff page has always counted them. */
registerStaffColumn({
  id: "activities.classes",
  header: "Classes",
  async values(userIds) {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.course.groupBy({ by: ["instructorId"], where: { instructorId: { in: userIds } }, _count: { _all: true } });
    return new Map(rows.filter((row) => row.instructorId).map((row) => [row.instructorId!, String(row._count._all)]));
  },
});

/** What each site runs in Aquatics: live programmes, active swimmers and live classes. */
registerSiteSummary({
  id: "activities.site",
  async lines(clubIds) {
    if (clubIds.length === 0) return new Map();
    const [programmes, students, courses] = await Promise.all([
      prisma.programme.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
      prisma.student.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, status: "ACTIVE" }, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
    ]);
    const count = (rows: { clubId: string; _count: { _all: number } }[], id: string) => rows.find((row) => row.clubId === id)?._count._all ?? 0;
    return new Map(clubIds.map((id) => [id, [
      plural(count(programmes, id), "programme", "programmes"),
      plural(count(students, id), "active swimmer", "active swimmers"),
      plural(count(courses, id), "class", "classes"),
    ].join(" · ")]));
  },
});

/** The Swim school on the home page, for the viewer's working site. Quick
 *  actions for the desk's everyday jobs, today's classes and assessments, the
 *  follow-up queues with their counts, and links to the rest. Each thing
 *  appears only when the viewer can already open it. */
type SwimLine = HomeItem & { screen: ScreenKey; permission?: PermissionKey };
const SWIM_ACTIONS: readonly SwimLine[] = [
  { kind: "action", icon: "search", label: "Find a swimmer", href: "/students", screen: "students" },
  { kind: "action", icon: "userPlus", label: "Add a swimmer", href: "/students?add=1", screen: "students", permission: "students.manage" },
  { kind: "action", icon: "calendarPlus", label: "Book an assessment", href: "/assessments", screen: "assessments", permission: "enrolment.manage" },
];
const SWIM_LINKS: readonly SwimLine[] = [
  { label: "Duty manager", hint: "Today's classes and cancelling a session", href: "/duty", screen: "duty" },
  { label: "Cancelled classes", hint: "Follow up billing", href: "/cancellations", screen: "cancellations" },
  { label: "Programmes and levels", href: "/programmes", screen: "programmes" },
  { label: "Reports", href: "/analytics", screen: "analytics" },
];

const plainCount = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

registerHomeCard({
  moduleId: "swim-school",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const screens = visibleScreens(held);
    const allowed = (line: SwimLine) => screens.has(line.screen) && (!line.permission || held.has(line.permission));
    const strip = ({ label, hint, href, kind, icon }: SwimLine): HomeItem => ({ label, hint, href, kind, icon });
    const iso = today();
    const [classes, cancelled, assessments, awaiting, parentUpdates] = await Promise.all([
      screens.has("calendar") ? getCoursesOnDay(weekdayOfIso(iso)) : null,
      screens.has("calendar") ? getCancellationsForDay(iso) : null,
      screens.has("calendar") ? getTodayAssessments(iso) : null,
      screens.has("awaiting-enrolment") ? getAwaitingEnrolment() : null,
      screens.has("students") && held.has("students.manage") ? prisma.parentChangeRequest.count({ where: { status: "PENDING" } }) : null,
    ]);
    const items: HomeItem[] = SWIM_ACTIONS.filter(allowed).map(strip);
    if (classes && cancelled) {
      const off = classes.filter((c) => cancelled.has(c.id)).length;
      items.push({ kind: "today", label: "Classes today", count: classes.length - off, hint: off ? `${plainCount(off, "class", "classes")} cancelled` : "None cancelled", href: "/schedule" });
    }
    if (assessments) {
      const booked = assessments.reduce((sum, a) => sum + a.booked, 0);
      items.push({ kind: "today", label: "Assessments today", count: assessments.length, hint: assessments.length ? `${plainCount(booked, "swimmer", "swimmers")} booked` : "No sessions today", href: "/schedule" });
    }
    if (awaiting) items.push({ label: "Awaiting enrolment", hint: "Class places and family follow-ups", href: "/awaiting-enrolment", count: awaiting.total, attention: awaiting.total > 0 });
    if (parentUpdates !== null) items.push({ label: "Parent updates", hint: "Contact and medical corrections", href: "/students/parent-changes", count: parentUpdates, attention: parentUpdates > 0 });
    return [...items, ...SWIM_LINKS.filter(allowed).map(strip)];
  },
});

/** The Pool deck on the home page: the teacher's own classes today, what is
 *  next, and the swimmer lookup. */
registerHomeCard({
  moduleId: "pool-deck",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    if (!visibleScreens(held).has("instructor")) return [];
    const iso = today(), now = minutesNow();
    const [courses, covers, cancelled] = await Promise.all([getCoursesOnDay(weekdayOfIso(iso)), getCoversForDay(iso), getCancellationsForDay(iso)]);
    const mine = courses.filter((c) => (c.instructorId === viewer.id || covers.get(c.id)?.coverById === viewer.id) && !cancelled.has(c.id));
    const ahead = mine.filter((c) => c.startMinutes + c.durationMinutes > now);
    return [
      {
        kind: "today", label: "Your classes today", href: "/instructor", count: mine.length,
        hint: ahead.length ? `Next at ${formatTime(ahead[0].startMinutes)}` : mine.length ? "All done for today" : "Nothing on your list today",
        list: ahead.slice(0, 3).map((c) => ({ label: courseName(c), hint: `${formatTime(c.startMinutes)} to ${formatTime(c.startMinutes + c.durationMinutes)} · ${c.location || "Pool"}` })),
      },
      { kind: "action", icon: "clipboardCheck", label: "Open my classes", href: "/instructor" },
      { label: "Find a swimmer in your classes", href: "/instructor/swimmers" },
    ];
  },
});