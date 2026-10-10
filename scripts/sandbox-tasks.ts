import type { PrismaClient } from "../src/generated/prisma/client";
import { addDays, exceptions, score, taskState, tasksOn, type TaskDefinition, type TaskSchedule, type TaskState, type TemplateKind } from "../src/modules/tasks/shared/rules";

/** The sandbox's Tasks (docs/tasks.md): both sites' settings, five templates (scheduled, ad hoc
 *  and a follow-up action) and two weeks of history at both sites with frozen scores, so Today,
 *  Actions, Reports, Sites and Activity have something to show. Outcomes are fixed, so screenshots
 *  repeat. Invented people only. */
export async function seedTasks(prisma: PrismaClient, ORG: string, roles: Record<string, string>) {
  const dayNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
  const from = addDays(dayNow, -21);
  const daily = (start: string, due: string, id = "daily"): TaskSchedule => ({ id, repeat: "daily", every: 1, weekdays: [], from, start, due });
  const guards = [roles["Lifeguard"], roles["Pool supervisor"]];

  // Riverside is in the city, open 06:00 to 22:00; Hillview opens later and closes on Christmas Day.
  const christmas = `${dayNow.slice(0, 4)}-12-25`;
  await prisma.taskSite.createMany({ data: [
    { siteId: "club_bishopstown", area: "City", opening: "06:00", closing: "22:00", closedDates: [] },
    { siteId: "club_churchfield", area: "Suburbs", opening: "07:00", closing: "21:00", closedDates: [new Date(`${christmas}T00:00:00Z`)] },
  ] });

  type SeedTemplate = TaskDefinition & { id: string; kind: TemplateKind; schedules: TaskSchedule[]; notifyException?: boolean };
  const templates: SeedTemplate[] = [
    { id: "tpl_opening", kind: "repeat", title: "Pool opening checks", description: "Make sure the pool is safe before the first swim.", priority: true, tags: ["Pool", "Opening"], roleIds: guards, restricted: true,
      checklist: ["Pool surround and emergency exits clear", "Rescue equipment in place", "Pool alarm tested", "Changing areas clean"], fields: [], minimumRecords: 1, logMode: "form",
      requiresComment: false, requiresApproval: true, schedules: [daily("open", "07:30")] },
    { id: "tpl_water", kind: "repeat", title: "Pool water quality", description: "Take a reading from the main pool. Raise an action for anything out of range.", priority: true, tags: ["Pool", "Safety"], roleIds: guards, restricted: true,
      checklist: [], minimumRecords: 1, logMode: "form", requiresComment: false, requiresApproval: false, notifyException: true,
      fields: [
        { id: "ph", label: "pH", type: "number", required: true, min: 7.2, max: 7.6, warning: "Check dosing and retest.", needsAction: true },
        { id: "cl", label: "Free chlorine", type: "number", required: true, min: 1, max: 3, unit: "mg/L", warning: "Follow the site procedure and retest.", needsAction: true },
        { id: "temp", label: "Water temperature", type: "number", required: false, unit: "°C" },
      ],
      schedules: [daily("08:00", "09:00", "am"), daily("12:00", "13:00", "mid"), daily("19:00", "close", "pm")] },
    { id: "tpl_changing", kind: "repeat", title: "Changing room checks", description: "", priority: false, tags: ["Hygiene"], roleIds: [], restricted: false,
      checklist: ["Floors dry", "Bins emptied", "Lockers checked"], fields: [{ id: "state", label: "Overall", type: "choice", required: true, options: ["Good", "Needs attention"] }],
      minimumRecords: 1, logMode: "form", requiresComment: false, requiresApproval: false, schedules: [daily("20:00", "20:30")] },
    { id: "tpl_spill", kind: "adhoc", title: "Spill clean-up", description: "When something is spilled: clear it, sign it off with a photo.", priority: false, tags: ["Hygiene"], roleIds: [], restricted: false,
      checklist: ["Area coned off", "Spill cleared"], fields: [{ id: "photo", label: "Photo after", type: "file", required: false }], minimumRecords: 1, logMode: "form",
      requiresComment: false, requiresApproval: false, schedules: [] },
    { id: "tpl_retest", kind: "action", title: "Retest the pool water", description: "After adjusting the dosing, retest each pool and record the readings.", priority: true, tags: ["Pool", "Safety"], roleIds: guards, restricted: false,
      checklist: ["Dosing adjusted"], minimumRecords: 2, logMode: "table", requiresComment: true, requiresApproval: false,
      fields: [{ id: "pool", label: "Pool", type: "choice", required: true, options: ["Main pool", "Learner pool"] }, { id: "ph", label: "pH", type: "number", required: true, min: 7.2, max: 7.6 }],
      schedules: [] },
  ];
  for (const { id, schedules, fields, notifyException, ...rest } of templates) {
    await prisma.taskTemplate.create({ data: { id, orgId: ORG, ...rest, fields, schedules, notifyException: !!notifyException, status: "published", publishedAt: new Date(`${from}T00:00:00Z`), createdByName: "Liam Example" } });
  }
  const now = new Date();
  let n = 0;
  for (const siteId of ["club_bishopstown", "club_churchfield"]) {
    const who = siteId === "club_bishopstown" ? ["sbx_riley", "Riley Example"] : ["sbx_ciara", "Ciara Example"];
    const site = siteId === "club_bishopstown" ? { timezone: "Europe/Dublin", opening: "06:00", closing: "22:00" } : { timezone: "Europe/Dublin", opening: "07:00", closing: "21:00" };
    for (let back = 13; back >= 0; back--) {
      const d = addDays(dayNow, -back);
      const states: TaskState[] = [];
      for (const t of templates) {
        const { id: templateId, kind, schedules } = t;
        const def: TaskDefinition = { title: t.title, description: t.description, priority: t.priority, tags: t.tags, roleIds: t.roleIds, restricted: t.restricted, checklist: t.checklist, fields: t.fields, minimumRecords: t.minimumRecords, logMode: t.logMode, requiresComment: t.requiresComment, requiresApproval: t.requiresApproval };
        if (kind !== "repeat") continue;
        for (const slot of tasksOn(schedules, d, site)) {
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
          states.push(taskState({ status: finished ? "done" : "open", date: d, startsAt: slot.startsAt, dueAt: slot.dueAt, completedAt, approvedAt: approved ? completedAt : null, requiresApproval: def.requiresApproval }, now, dayNow));
          if (found.length) {
            await prisma.taskAction.create({ data: { orgId: ORG, siteId, taskId: task.id, title: "Retest after adjusting the dosing", dueOn: new Date(`${d}T00:00:00Z`), raisedById: who[0], raisedByName: who[1],
              ...(back > 2 ? { status: "resolved", resolvedAt: completedAt, resolvedByName: "Sam Example", resolution: "Dosing adjusted; retested at 7.4." } : {}) } });
          }
        }
      }
      // Finished days are frozen, as the nightly cron does.
      if (back > 0) await prisma.taskScoreSnapshot.create({ data: { siteId, date: new Date(`${d}T00:00:00Z`), score: score(states), count: states.length } });
    }
  }
}
