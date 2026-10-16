import { today } from "@/lib/format";
import { courseInsight, csvRows, learnerCsv, readFilters } from "@/modules/training/features/insight";

/** Everyone the reader covers who was given this course, and where they are, as a CSV for Excel. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const q = new URL(request.url).searchParams;
  let data: Awaited<ReturnType<typeof courseInsight>> = null;
  try {
    data = await courseInsight((await params).id, readFilters({ site: q.get("site") ?? undefined, period: q.get("period") ?? undefined }));
  } catch {
    data = null;
  }
  if (!data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const name = data.course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "course";
  return new Response(`﻿${csvRows(learnerCsv(data))}\r\n`, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${name}-${today()}.csv"`,
  } });
}
