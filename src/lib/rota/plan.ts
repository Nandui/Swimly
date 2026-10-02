import { clock, type RotaWarning } from "@/lib/rota/constants";

/** The week plan (owner request, 1 October 2026: "department supervisors plan
 *  the weeks and days, X staff does X"): one row per duty, grouped by
 *  department, a column per day, each entry saying when and who. Unfilled
 *  duties stay on their duty's row. Holiday and leave from the retired
 *  roster upload are not duties and are left out. Pure and tested; the page
 *  loads the shifts and the plan component draws it. */

export type PlanShift = {
  id: string;
  kind: string;
  startMinutes: number;
  endMinutes: number;
  role: string;
  note: string;
  importId: string | null;
  userId: string | null;
  rotaPersonId: string | null;
  departmentId: string | null;
  user: { name: string } | null;
  rotaPerson: { name: string } | null;
  department: { name: string; sortOrder: number } | null;
  requiredType: { name: string } | null;
  /** Set on a place at a booking's session: the role it is for. */
  bookingNeed?: { role: string } | null;
  warnings: RotaWarning[];
};

export type PlanEntry = {
  id: string;
  /** "06:30–14:00". */
  text: string;
  minutes: number;
  /** Who does it; null when it is unfilled. */
  who: string | null;
  /** The booking role this place is for, e.g. "Swim teacher". */
  part: string | null;
  absent: boolean;
  /** Qualification and double-booking warnings, never "absent" or "open". */
  warnings: RotaWarning[];
  /** Added in Turnfin, so it can be changed here; old imported ones cannot. */
  editable: boolean;
  /** Set on the Swim school's row: where its classes are seen and changed. */
  href?: string;
  detail: string;
};

export type PlanRow = { key: string; duty: string; needs: string; days: PlanEntry[][] };
export type PlanGroup = { key: string; label: string; rows: PlanRow[] };

const NO_DEPARTMENT = "No department";

/** Hours as the plan shows them: "37.5", "8", "0". */
export function hours(minutes: number) {
  const h = Math.round((minutes / 60) * 4) / 4;
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "");
}

/** The swim classes of one day, from the Swim school: times and who teaches. */
export type PlanClass = { userId: string | null; startMinutes: number; endMinutes: number; href?: string };

export function buildPlan(days: readonly { iso: string; shifts: readonly PlanShift[]; classes?: readonly PlanClass[] }[]) {
  const groups = new Map<string, { key: string; label: string; order: number; rows: Map<string, PlanRow> }>();
  days.forEach((d, day) => {
    for (const s of d.shifts) {
      if (s.kind !== "shift") continue;
      const label = s.department?.name ?? NO_DEPARTMENT;
      const g = groups.get(label) ?? { key: `g:${s.departmentId ?? "none"}`, label, order: s.department ? s.department.sortOrder : Number.MAX_SAFE_INTEGER, rows: new Map() };
      groups.set(label, g);
      const dutyKey = s.role.trim().toLowerCase();
      const row = g.rows.get(dutyKey) ?? { key: `${g.key}:${dutyKey}`, duty: s.role.trim(), needs: "", days: days.map(() => []) };
      if (s.requiredType && !row.needs) row.needs = `Needs ${s.requiredType.name}`;
      g.rows.set(dutyKey, row);
      row.days[day].push({
        id: s.id, text: `${clock(s.startMinutes)}–${s.endMinutes > 1440 ? clock(s.endMinutes - 1440) : clock(s.endMinutes)}`,
        minutes: Math.max(0, s.endMinutes - s.startMinutes),
        who: s.user?.name ?? s.rotaPerson?.name ?? null,
        part: s.bookingNeed?.role ?? null,
        absent: s.warnings.includes("absent"),
        warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"),
        editable: !s.importId,
        detail: [s.requiredType ? `Needs ${s.requiredType.name}` : null, s.note || null].filter(Boolean).join(" · "),
      });
    }
  });
  // The Swim school's classes, read-only: one entry a day with how many and who teaches.
  if (days.some((d) => d.classes?.length)) {
    groups.set("Swim school", { key: "g:swim", label: "Swim school", order: Number.MAX_SAFE_INTEGER - 1, rows: new Map([["swim", {
      key: "g:swim:classes", duty: "Swim classes", needs: "Instructors are set in the Swim school",
      days: days.map((d) => {
        const list = d.classes ?? [];
        if (!list.length) return [];
        const start = Math.min(...list.map((c) => c.startMinutes)), end = Math.max(...list.map((c) => c.endMinutes));
        const instructors = new Set(list.flatMap((c) => (c.userId ? [c.userId] : []))).size;
        const open = list.filter((c) => !c.userId).length;
        return [{
          id: `swim:${d.iso}`, text: `${clock(start)}–${clock(end)}`, minutes: 0,
          who: `${list.length} ${list.length === 1 ? "class" : "classes"} · ${instructors} ${instructors === 1 ? "instructor" : "instructors"}`,
          part: open ? `${open} without an instructor` : null, absent: false, warnings: [], editable: false, detail: "From the Swim school timetable",
          href: list[0].href,
        }];
      }),
    }]]) });
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, rows }) => ({
      key, label,
      rows: [...rows.values()]
        .map((r) => ({ ...r, days: r.days.map((cell) => cell.sort((a, b) => a.text.localeCompare(b.text) || (a.part ?? "").localeCompare(b.part ?? ""))) }))
        .sort((a, b) => a.duty.localeCompare(b.duty)),
    }));
  const all = days.map((d) => d.shifts.filter((s) => s.kind === "shift"));
  return {
    groups: sorted,
    /** Duties with nobody on them, each day. */
    unfilled: days.map((d) => d.shifts.filter((s) => s.kind === "shift" && !s.userId && !s.rotaPersonId).length),
    /** People on a duty each day, not counting anyone off. */
    onShift: all.map((list) => new Set(list.filter((s) => (s.userId || s.rotaPersonId) && !s.warnings.includes("absent")).map((s) => s.userId ?? s.rotaPersonId)).size),
    dayMinutes: all.map((list) => list.filter((s) => s.userId || s.rotaPersonId).reduce((m, s) => m + Math.max(0, s.endMinutes - s.startMinutes), 0)),
  };
}
export type RotaPlanData = ReturnType<typeof buildPlan>;
