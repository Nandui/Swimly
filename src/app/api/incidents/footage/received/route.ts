import { after } from "next/server";
import { finishUpload, IncidentError, requestOrigin, sendFootageReceived } from "@/modules/incidents/features/footage";

/** Records a video from a footage link once the store holds all of it, and
 *  tells the person who asked ("CCTV footage"). */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Send footage from the link's own page." }, { status: 403 });
    const done = await finishUpload(await request.json());
    if (done.fresh) {
      const from = await requestOrigin();
      after(() => sendFootageReceived(done.id, from));
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof IncidentError ? error.message : "Could not record the video. Try again." }, { status: 400 });
  }
}
