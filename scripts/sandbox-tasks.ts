import type { PrismaClient } from "../src/generated/prisma/client";
import { addDays, exceptions, tasksOn, type TaskDefinition, type TaskSchedule } from "../src/lib/tasks/rules";

/** The sandbox's Tasks (docs/tasks.md): four templates and two weeks of history at both sites,
 *  so Today, Actions and Reports have something to show. Outcomes are fixed, so screenshots
 *  repeat. Invented people only. */
export async function seedTasks(prisma: PrismaClient, ORG: string, roles: Record<string, string>) {
  const dayNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
  const from = addDays(dayNow, -21);
  const daily = (start: string, due: string, id = "daily"): TaskSchedule => ({ id, repeat: "daily", every: 1, weekdays: [], from, start, due });
  const guards = [roles["Lifeguard"], roles["Pool supervisor"]];
  type SeedTemplate = TaskDefinition & { id: string; schedules: TaskSchedule[] };
  const templates: SeedTemplate[] = [
    { id: "tpl_opening", title: "Pool opening checks", description: "Make sure the pool is safe before the first swim.", priority: true, tags: ["Pool", "Opening"], roleIds: guards,
      checklist: ["Pool surround and emergency exits clear", "Rescue equipment in place", "Pool alarm tested", "Changing areas clean"], fields: [], minimumRecords: 1,
      requiresComment: false, requiresApproval: true, schedules: [daily("06:00", "07:00")] },
    { id: "tpl_water", title: "Pool water quality", description: "Take a reading from the main pool. Raise an action for anything out of range.", priority: true, tags: ["Pool", "Safety"], roleIds: guards,
      checklist: [], minimumRecords: 1, requiresComment: false, requiresApproval: false,
      fields: [
        { id: "ph", label: "pH", type: "number", required: true, min: 7.2, max: 7.6, warning: "Check dosing and retest.", needsAction: true },
        { id: "cl", label: "Free chlorine", type: "number", required: true, min: 1, max: 3, unit: "mg/L", warning: "Follow the site procedure and retest.", needsAction: true },
        { id: "temp", label: "Water temperature", type: "number", required: false, unit: "°C" },
      ],
      schedules: [daily("08:00", "09:00", "am"), daily("12:00", "13:00", "mid"), daily("19:00", "21:30", "pm")] },
    { id: "tpl_changing", title: "Changing room checks", description: "", priority: false, tags: ["Hygiene"], roleIds: [],
      checklist: ["Floors dry", "Bins emptied", "Lockers checked"], fields: [{ id: "state", label: "Overall", type: "choice", required: true, options: ["Good", "Needs attention"] }],
      minimumRecords: 1, requiresComment: false, requiresApproval: false, schedules: [daily("20:00", "20:30")] },
    { id: "tpl_spill", title: "Spill clean-up", description: "When something is spilled: clear it, sign it off with a photo.", priority: false, tags: ["Hygiene"], roleIds: [],
      checklist: ["Area coned off", "Spill cleared"], fields: [{ id: "photo", label: "Photo after", type: "file", required: false }], minimumRecords: 1,
      requiresComment: false, requiresApproval: false, schedules: [] },
  ];
  for (const { id, schedules, fields, ...rest } of templates) {
    await prisma.taskTemplate.create({ data: { id, orgId: ORG, ...rest, fields, schedules, status: "published", publishedAt: new Date(`${from}T00:00:00Z`), createdByName: "Liam Example" } });
  }
  const now = new Date();
  let n = 0;
  for (const siteId of ["club_bishopstown", "club_churchfield"]) {
    const who = siteId === "club_bishopstown" ? ["sbx_riley", "Riley Example"] : ["sbx_ciara", "Ciara Example"];
    for (let back = 13; back >= 0; back--) {
      const d = addDays(dayNow, -back);
      for (const { id: templateId, schedules, ...def } of templates) {
        for (const slot of tasksOn(schedules, d)) {
          n++;
          const records = templateId === "tpl_water" ? [{ ph: n % 17 === 0 ? "7.9" : "7.4", cl: "1.8", temp: "29" }] : templateId === "tpl_changing" ? [{ state: "Good" }] : [{}];
          // Only what is past due is done; mostly on time, some late, a few missed.
          const finished = slot.dueAt < now && n % 11 !== 0;
          const completedAt = finished ? new Date(n % 7 === 0 ? slot.dueAt.getTime() + 25 * 60_000 : slot.startsAt.getTime() + 20 * 60_000) : null;
          const found = finished ? exceptions(def, records) : [];
          const approved = finished && def.requiresApproval && back > 0;
          const task = await prisma.task.create({ data: {
            orgId: ORG, templateId, siteId, date: new Date(`${d}T00:00:00Z`), scheduleKey: slot.scheduleKey, startsAt: slot.startsAt, dueAt: slot.dueAt,
            definition: def, checks: def.checklist.map(() => finished), records: finished ? records : [{}], status: finished ? "done" : "open", exceptions: found,
            completedAt, completedById: finished ? who[0] : null, completedByName: finished ? who[1] : null,
            approvedAt: approved ? completedAt : null, approvedById: approved ? "sbx_maya" : null, approvedByName: approved ? "Maya Example" : null,
          }, select: { id: true } });
          if (found.length) {
            await prisma.taskAction.create({ data: { orgId: ORG, siteId, taskId: task.id, title: "Retest after adjusting the dosing", dueOn: new Date(`${d}T00:00:00Z`), raisedById: who[0], raisedByName: who[1],
              ...(back > 2 ? { status: "resolved", resolvedAt: completedAt, resolvedByName: "Sam Example", resolution: "Dosing adjusted; retested at 7.4." } : {}) } });
          }
        }
      }
    }
  }
}
