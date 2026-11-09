import { appRoute } from "@/lib/apps/switches";
import { runDailyDigest } from "@/modules/hr/features/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily (Vercel cron): emails yesterday's HR reports, by person, to the
 *  addresses in HR > Settings, once a day. Vercel sends
 *  `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
async function serveGet(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDailyDigest(new URL(request.url).origin), { headers: { "Cache-Control": "no-store" } });
}

export const GET = appRoute("hr", serveGet);
