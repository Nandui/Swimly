import "server-only";
import { logAudit } from "@/lib/audit";
import { departmentsForSite } from "@/lib/directory";
import { isDateOnly, today } from "@/lib/format";
import { writeWorkbook } from "@/lib/xlsx-write";
import { addDaysIso, clock, mondayOf } from "@/modules/rota/shared/constants";
import { pickSite, loadDays } from "@/modules/rota/shared/data";
import { buildDay } from "@/modules/rota/shared/day";
import { partPaid } from "@/modules/rota/shared/plan-rows";
import { staffOf } from "@/modules/rota/features/plan/server/data";

/** A department's week as a simple Excel sheet, to put into Timepoint (owner, 13 October 2026:
 *  "for now, just export in a simple xls"): one row per shift, with its paid hours and its unpaid
 *  break minutes. For people who plan at the site (Plan or Run); null when they may not. */
export async function planExport(input: { site?: string; week?: string; dept?: string }) {
  const { who, site } = await pickSite(input.site);
  if (!site?.plan) return null;
  const orgId = who.orgId ?? undefined;
  const departments = await departmentsForSite(orgId ?? null, site.id);
  const department = departments.find((d) => d.id === input.dept);
  if (!department) return null;
  const monday = mondayOf(input.week && isDateOnly(input.week) ? input.week : today());
  const sunday = addDaysIso(monday, 6);
  const { dayInput } = await loadDays(site.id, orgId, monday, sunday);
  const names = new Map(departments.map((d) => [d.id, d.name]));
  const rows: (string | number)[][] = [];
  for (let i = 0; i < 7; i++) {
    const day = buildDay(dayInput(addDaysIso(monday, i)));
    for (const p of [...staffOf(day, department.id)].sort((a, b) => a.name.localeCompare(b.name))) {
      for (const part of p.shift.parts) {
        const { paid, unpaid } = partPaid(part);
        const planned = p.planned.find((s) => s.startMinutes < part.end && part.start < s.endMinutes);
        rows.push([p.name, day.date, clock(part.start), clock(part.end), Math.round((paid / 60) * 100) / 100, unpaid, names.get(planned?.departmentId ?? department.id) ?? department.name]);
      }
    }
  }
  await logAudit({ actorId: who.id, actorName: who.name, action: "export", entity: "RotaPlanShift", entityId: null, clubId: site.id,
    summary: `Exported ${department.name}'s week of ${monday} at ${site.name} for Timepoint: ${rows.length} shifts` });
  const file = writeWorkbook(`${department.name} ${monday}`, [["Name", "Date", "Start", "End", "Paid hours", "Break minutes", "Department"], ...rows], [28, 12, 8, 8, 11, 14, 20]);
  return { file, name: `rota-${department.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${monday}.xlsx` };
}
