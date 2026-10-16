import { today } from "@/lib/format";
import { cellInWords, csvRows, trainingMatrix } from "@/modules/training/features/compliance";

/** The training matrix as a CSV for Excel, with the page's filters, for the people the reader
 *  covers. Anyone without Training access gets the same answer as a missing page. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  let matrix: Awaited<ReturnType<typeof trainingMatrix>>;
  try {
    matrix = await trainingMatrix({ site: q.get("site") || undefined, department: q.get("department") || undefined, course: q.get("course") || undefined });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const csv = csvRows([
    ["Person", "In date", ...matrix.columns.map((c) => c.title)],
    ...matrix.rows.map((r) => [r.name, `${r.compliant} of ${r.needed}`, ...r.cells.map(cellInWords)]),
  ]);
  return new Response(`﻿${csv}\r\n`, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="training-matrix-${today()}.csv"`,
  } });
}
