import { appRoute } from "@/lib/apps/switches";
import { readPhoto, requireMaintenanceActor } from "@/modules/maintenance/features/photos";

/** Opens a request's photo for someone who may see the request. */
async function serveGet(_request: Request, { params }: RouteContext<"/api/maintenance/photos/[id]">) {
  try {
    const who = await requireMaintenanceActor(), { id } = await params;
    const photo = await readPhoto(who, id);
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.mime, "Content-Length": String(photo.size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(photo.name)}`,
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch {
    return new Response("Photo not available.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = appRoute("maintenance", serveGet);
