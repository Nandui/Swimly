import { auth } from "@/auth";
import { tasksAccess } from "@/lib/tasks/access";
import { taskReport } from "@/lib/tasks/data";
import { TASK_STATE_META, clockOf, csvRows } from "@/lib/tasks/rules";

/** Every task in the report's range, as a CSV a spreadsheet opens safely (no formulas).
 *  For reviewers, at the sites they review only. */
export async function GET(request: Request) {
  const session = await auth();
  const who = session?.user ? tasksAccess(session) : null;
  if (!who?.review) return new Response("Not found", { status: 404 });
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const r = await taskReport(q);
  const csv = csvRows([
    ["Site", "Date", "Task", "Due", "State", "By", "Approved by", "Out of range", "Reason"],
    ...r.tasks.map((t) => [t.siteName, t.date, t.title, clockOf(t.dueAt), TASK_STATE_META[t.state].label, t.completedByName ?? "", t.approvedByName ?? "", t.exceptionList.join(" | "), t.reason]),
  ]);
  return new Response(`﻿${csv}\r\n`, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="tasks-${r.from}-to-${r.to}.csv"`,
  } });
}
