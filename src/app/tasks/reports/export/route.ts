import { auth } from "@/auth";
import { tasksAccess } from "@/modules/tasks/lib/access";
import { taskReport } from "@/modules/tasks/lib/data";
import { TASK_STATE_META, clockOf, csvRows } from "@/modules/tasks/lib/rules";

/** The report as a CSV a spreadsheet opens safely (no formulas): `kind=scores` gives each site's
 *  score per day (frozen or provisional), otherwise every task in the range with the report's
 *  filters. For reviewers, at the sites they review only. */
export async function GET(request: Request) {
  const session = await auth();
  const who = session?.user ? tasksAccess(session) : null;
  if (!who?.review) return new Response("Not found", { status: 404 });
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const r = await taskReport(q);
  const scores = q.kind === "scores";
  const csv = scores
    ? csvRows([
        ["Site", "Date", "Score (0-100)", "Tasks", "Frozen"],
        ...r.daily.map((d) => [d.siteName, d.date, d.score ?? "", d.count, d.frozen ? "Yes" : "Provisional"]),
      ])
    : csvRows([
        ["Site", "Date", "Task", "Due", "State", "Completed at", "By", "Approval", "Out of range", "Reason"],
        ...r.tasks.map((t) => [t.siteName, t.date, t.title, clockOf(t.dueAt), TASK_STATE_META[t.state].label, t.completedAt?.toISOString() ?? "", t.completedByName ?? "",
          t.approvedByName ? `Approved by ${t.approvedByName}` : t.state === "approval" ? "Waiting" : "Not required", t.exceptionList.join(" | "), t.reason]),
      ]);
  return new Response(`﻿${csv}\r\n`, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="tasks-${scores ? "scores" : "report"}-${r.from}-to-${r.to}.csv"`,
  } });
}
