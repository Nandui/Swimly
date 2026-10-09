import { logAudit } from "@/lib/audit";
import { AuthorizationError } from "@/lib/authz";
import { today } from "@/lib/format";
import { writeWorkbook, XLSX_TYPE } from "@/lib/xlsx-write";
import { BULK_LOG_COLUMNS, bulkLogRows } from "@/modules/activities/lib/cancellations/bulk-log";
import { getBillingExport } from "@/modules/activities/lib/cancellations/data";

/** Cancelled classes as Legend's bulk update template (owner decision, 9 October 2026): every
 *  cancellation in the chosen view at this site, one row for each affected member. For those
 *  who can open Cancelled classes; the export is in the activity log. */
export async function GET(request: Request) {
  const notified = new URL(request.url).searchParams.get("status") === "notified";
  let data;
  try {
    data = await getBillingExport(notified);
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const rows = bulkLogRows(data.cancellations);
  const bytes = writeWorkbook("Bulk Update Template - BO", [[...BULK_LOG_COLUMNS], ...rows], BULK_LOG_COLUMNS.map((c) => Math.max(12, c.length + 2)));
  await logAudit({ actorId: data.session.user.id, actorName: data.session.user.name ?? "Unknown", action: "export", entity: "Course", entityId: "cancellations", clubId: data.clubId,
    summary: `Exported the Legend bulk update for ${data.cancellations.length} ${notified ? "notified" : "awaiting"} cancelled classes: ${rows.length} members` });
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": XLSX_TYPE, "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="cancelled-classes-bulk-log-${notified ? "notified" : "awaiting"}-${today()}.xlsx"`,
  } });
}
