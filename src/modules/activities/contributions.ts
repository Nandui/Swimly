import "server-only";
import { prisma } from "@/lib/prisma";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";
import { registerHomeCard, registerSiteSummary, registerStaffColumn, type HomeItem } from "@/modules/contributions";

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

/** The Swim school card on the home page: the everyday jobs only (everything
 *  else is one click away inside the module). The desk's tasks and follow-ups,
 *  the duty manager and the office for managers. Each line appears only when
 *  the viewer can already open it. */
const SWIM_LINKS: readonly (HomeItem & { screen: ScreenKey; permission?: PermissionKey })[] = [
  { label: "Find a swimmer", hint: "Details, progress and enrolment", href: "/students", screen: "students" },
  { label: "Add a swimmer", hint: "Create a new swimmer record", href: "/students", screen: "students", permission: "students.manage" },
  { label: "Today's classes", hint: "Classes and assessments by day", href: "/schedule", screen: "calendar" },
  { label: "Book an assessment", hint: "Find a session and book a place", href: "/assessments", screen: "assessments", permission: "enrolment.manage" },
  { label: "Awaiting enrolment", hint: "Class places and family follow-ups", href: "/awaiting-enrolment", screen: "awaiting-enrolment" },
  { label: "Parent updates", hint: "Contact and medical corrections from parents", href: "/students/parent-changes", screen: "students", permission: "students.manage" },
  { label: "Duty manager", hint: "Today's classes and cancelling a session", href: "/duty", screen: "duty" },
  { label: "Cancelled classes", hint: "Follow up billing", href: "/cancellations", screen: "cancellations" },
  { label: "Programmes and levels", href: "/programmes", screen: "programmes" },
  { label: "Reports", href: "/analytics", screen: "analytics" },
];

registerHomeCard({
  moduleId: "swim-school",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const screens = visibleScreens(viewer.screens, held);
    return SWIM_LINKS
      .filter((link) => screens.has(link.screen) && (!link.permission || held.has(link.permission)))
      .map(({ label, hint, href }) => ({ label, hint, href }));
  },
});

/** The Pool deck card: a teacher's classes today and the swimmer lookup. */
registerHomeCard({
  moduleId: "pool-deck",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    if (!visibleScreens(viewer.screens, held).has("instructor")) return [];
    return [
      { label: "Your classes today", hint: "Attendance, competencies and assessments", href: "/instructor" },
      { label: "Find a swimmer in your classes", href: "/instructor/swimmers" },
    ];
  },
});
