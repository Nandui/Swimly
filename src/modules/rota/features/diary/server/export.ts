import "server-only";
import { logAudit } from "@/lib/audit";
import { departmentsForSite } from "@/lib/directory";
import { isDateOnly, today } from "@/lib/format";
import { writeWorkbook } from "@/lib/xlsx-write";
import { addDaysIso, clock, mondayOf } from "@/modules/rota/shared/constants";
import { pickSite } from "@/modules/rota/shared/data";
import { buildDiary, partPay } from "@/modules/rota/features/diary/model";
import { diaryInputs } from "@/modules/rota/features/diary/server/load";

/** A department's week as a simple Excel sheet, to put into Timepoint (owner, 13 October 2026:
 *  "for now, just export in a simple xls"): one row per stretch someone works, from the diary,
 *  with its paid hours and its unpaid break minutes. For people who plan at the site (Plan or
 *  Run); null when they may not. */
export async function diaryExport(input: { site?: string; week?: string; dept?: string }) {
  const { who, site } = await pickSite(input.site);
  if (!site?.plan) return null;
  const orgId = who.orgId ?? null;
  const departments = await departmentsForSite(orgId, site.id);
  const department = departments.find((d) => d.id === input.dept);
  if (!department) return null;
  const monday = mondayOf(input.week && isDateOnly(input.week) ? input.week : today());
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const inputs = await diaryInputs(site.id, orgId, days, department.id);
  const names = new Map(departments.map((d) => [d.id, d.name]));
  const rows: (string | number)[][] = [];
  for (const date of days) {
    const day = inputs.get(date)!;
    const young = new Map(day.staff.map((s) => [s.userId, s.young]));
    for (const p of [...buildDiary(day).people].sort((a, b) => a.name.localeCompare(b.name))) {
      for (const part of p.parts) {
        const { paid, unpaid } = partPay(part, young.get(p.userId) ?? null);
        const shift = p.shifts.find((s) => s.start < part.end && part.start < s.end);
        rows.push([p.name, date, clock(part.start), clock(part.end), Math.round((paid / 60) * 100) / 100, unpaid, names.get(shift?.departmentId ?? department.id) ?? department.name]);
      }
    }
  }
  await logAudit({ actorId: who.id, actorName: who.name, action: "export", entity: "RotaPlanShift", entityId: null, clubId: site.id,
    summary: `Exported ${department.name}'s week of ${monday} at ${site.name} for Timepoint: ${rows.length} shifts` });
  const file = writeWorkbook(`${department.name} ${monday}`, [["Name", "Date", "Start", "End", "Paid hours", "Break minutes", "Department"], ...rows], [28, 12, 8, 8, 11, 14, 20]);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { file, name: `rota-${slug(department.name)}-${slug(site.name)}-${monday}.xlsx` };
}
