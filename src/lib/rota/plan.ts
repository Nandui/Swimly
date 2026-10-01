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
  warnings: RotaWarning[];
};

export type PlanEntry = {
  id: string;
  /** "06:30–14:00". */
  text: string;
  minutes: number;
  /** Who does it; null when it is unfilled. */
  who: string | null;
  absent: boolean;
  /** Qualification and double-booking warnings, never "absent" or "open". */
  warnings: RotaWarning[];
  /** Added in Turnfin, so it can be changed here; old imported ones cannot. */
  editable: boolean;
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

export function buildPlan(days: readonly { iso: string; shifts: readonly PlanShift[] }[]) {
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
        absent: s.warnings.includes("absent"),
        warnings: s.warnings.filter((w) => w !== "absent" && w !== "open"),
        editable: !s.importId,
        detail: [s.requiredType ? `Needs ${s.requiredType.name}` : null, s.note || null].filter(Boolean).join(" · "),
      });
    }
  });
  const sorted = [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, rows }) => ({
      key, label,
      rows: [...rows.values()]
        .map((r) => ({ ...r, days: r.days.map((cell) => cell.sort((a, b) => a.text.localeCompare(b.text))) }))
        .sort((a, b) => a.duty.localeCompare(b.duty)),
    }));
  const all = days.map((d) => d.shifts.filter((s) => s.kind === "shift"));
  return {
    groups: sorted,
    /** Duties with nobody on them, each day. */
    unfilled: all.map((list) => list.filter((s) => !s.userId && !s.rotaPersonId).length),
    /** People on a duty each day, not counting anyone off. */
    onShift: all.map((list) => new Set(list.filter((s) => (s.userId || s.rotaPersonId) && !s.warnings.includes("absent")).map((s) => s.userId ?? s.rotaPersonId)).size),
    dayMinutes: all.map((list) => list.filter((s) => s.userId || s.rotaPersonId).reduce((m, s) => m + Math.max(0, s.endMinutes - s.startMinutes), 0)),
  };
}
export type RotaPlanData = ReturnType<typeof buildPlan>;
