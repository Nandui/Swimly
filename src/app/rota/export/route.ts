import { AuthorizationError } from "@/lib/authz";
import { XLSX_TYPE } from "@/lib/xlsx-write";
import { diaryExport } from "@/modules/rota/features/diary";

/** A department's week of shifts as an Excel file for Timepoint (`site`, `dept`, `week`). For
 *  people who plan the rota at that site; each export is in the activity log. */
export async function GET(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  let out;
  try {
    out = await diaryExport(q);
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  if (!out) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(out.file), { headers: {
    "Content-Type": XLSX_TYPE, "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${out.name}"`,
  } });
}
