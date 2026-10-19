import { IncidentError, startUpload } from "@/modules/incidents/features/footage";

/** Starts one video from a footage link (docs/incidents.md, "CCTV footage").
 *  No sign-in: the link's secret in the body is the only key, and it opens one
 *  request. Answers with a token that uploads to one path in the store. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Send footage from the link's own page." }, { status: 403 });
    return Response.json({ ok: true, ...(await startUpload(await request.json())) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof IncidentError ? error.message : "Could not start the upload. Try again." }, { status: 400 });
  }
}
