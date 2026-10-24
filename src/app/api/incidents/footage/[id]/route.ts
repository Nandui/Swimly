import { appRoute } from "@/lib/apps/switches";
import { footageToWatch, logWatch, PLAYABLE, readFootage, requireIncidentsActor } from "@/modules/incidents/features/footage";

/** Plays or downloads a report's CCTV video for someone who triages at its
 *  site, streamed from the private store; seeking asks for a range. Opening
 *  one is logged once per viewing, not for every range a player asks for. */
export const maxDuration = 300;

async function serveGet(request: Request, { params }: RouteContext<"/api/incidents/footage/[id]">) {
  try {
    const who = await requireIncidentsActor(), { id } = await params;
    const footage = await footageToWatch(who, id);
    const range = request.headers.get("range");
    const blob = await readFootage(footage.url, range);
    if (!blob || blob.statusCode !== 200) throw new Error("Not in the store.");
    if (!range || /^bytes=0-/.test(range)) await logWatch(who, footage.reportId);
    const partial = blob.headers.get("content-range");
    const headers = new Headers({
      "Content-Type": footage.mime, "Accept-Ranges": "bytes",
      "Content-Disposition": `${PLAYABLE.has(footage.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(footage.name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; media-src 'self'; sandbox",
    });
    const length = blob.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    if (partial) headers.set("Content-Range", partial);
    return new Response(blob.stream, { status: partial ? 206 : 200, headers });
  } catch {
    return new Response("Video not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = appRoute("incidents", serveGet);
