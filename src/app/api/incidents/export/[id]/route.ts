import { appRoute } from "@/lib/apps/switches";
import { incidentExport, incidentPdf } from "@/modules/incidents/features/export";
import { incidentNumber } from "@/modules/incidents/features/reports";

/** One report's full record as a PDF file, for Manage at the report's site. `incidentExport`
 *  decides who may have it and puts every download in the report's history. */
async function serveGet(_request: Request, { params }: RouteContext<"/api/incidents/export/[id]">) {
  try {
    const { id } = await params;
    const data = await incidentExport(id);
    const bytes = await incidentPdf(data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf", "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${incidentNumber(data.report.number)}.pdf"`,
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Report not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = appRoute("incidents", serveGet);
