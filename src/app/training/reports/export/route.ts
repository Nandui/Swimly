import { today } from "@/lib/format";
import { coursesCsv, csvRows, overdueCsv, readFilters, trainingReport } from "@/modules/training/features/insight";

/** The reports page's overdue list or course table as a CSV for Excel, with the page's filters,
 *  for the people the reader covers. Anyone without Training access gets a missing page. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind") === "courses" ? "courses" : "overdue";
  let report: Awaited<ReturnType<typeof trainingReport>>;
  try {
    const filters = readFilters({ site: q.get("site") ?? undefined, department: q.get("department") ?? undefined });
    report = await trainingReport(filters);
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const csv = csvRows(kind === "courses" ? coursesCsv(report) : overdueCsv(report));
  return new Response(`﻿${csv}\r\n`, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="training-${kind === "courses" ? "courses" : "overdue"}-${today()}.csv"`,
  } });
}
