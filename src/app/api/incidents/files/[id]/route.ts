import { appRoute } from "@/lib/apps/switches";
import { readFile, requireIncidentsActor } from "@/modules/incidents/features/files";

/** Opens a report's photo or document for someone who may read the report.
 *  Photos open in the browser; PDFs download. Opening one on someone else's
 *  report is logged. */
async function serveGet(_request: Request, { params }: RouteContext<"/api/incidents/files/[id]">) {
  try {
    const who = await requireIncidentsActor(), { id } = await params;
    const file = await readFile(who, id);
    const disposition = file.mime.startsWith("image/") ? "inline" : "attachment";
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime, "Content-Length": String(file.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch {
    return new Response("File not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = appRoute("incidents", serveGet);
