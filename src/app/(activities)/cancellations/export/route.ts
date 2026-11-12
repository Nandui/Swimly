import { logAudit } from "@/lib/audit";
import { AuthorizationError } from "@/lib/authz";
import { today } from "@/lib/format";
import { writeWorkbook, XLSX_TYPE } from "@/lib/xlsx-write";
import { billingViewOf, BULK_LOG_COLUMNS, bulkLogRows, getBillingExport } from "@/modules/activities/features/cancellations";

/** Cancelled classes as Legend's bulk update template (owner decisions, 9 October 2026), one row
 *  for each affected member: `view=awaiting` to process them, `view=restore` after the direct
 *  debit run to put them back on their monthly price (NewCycleFee from the price list). `ids`
 *  names the classes on the page, so the confirmation after it marks the same ones. For those who
 *  can open Cancelled classes; each export is in the activity log. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = billingViewOf(params.get("view") ?? params.get("status"));
  if (view === "done") return new Response("Nothing to export from done.", { status: 400 });
  const ids = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 500);
  let data;
  try {
    data = await getBillingExport(view, ids);
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const restore = view === "restore";
  const rows = bulkLogRows(data.cancellations, restore ? { cycleFees: data.cycleFees } : {});
  const bytes = writeWorkbook("Bulk Update Template - BO", [[...BULK_LOG_COLUMNS], ...rows], BULK_LOG_COLUMNS.map((c) => Math.max(12, c.length + 2)));
  await logAudit({ actorId: data.session.user.id, actorName: data.session.user.name ?? "Unknown", action: "export", entity: "Course", entityId: "cancellations", clubId: data.clubId,
    summary: `Exported the Legend ${restore ? "price restore" : "bulk update"} for ${data.cancellations.length} cancelled classes: ${rows.length} members` });
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": XLSX_TYPE, "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="cancelled-classes-${restore ? "restore" : "bulk-log"}-${today()}.xlsx"`,
  } });
}
