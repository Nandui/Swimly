import { runActionReminders } from "@/modules/incidents/features/investigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily (Vercel cron): reminds each owner of an incident action due tomorrow
 *  or past its due day, once each. Vercel sends
 *  `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runActionReminders(new URL(request.url).origin), { headers: { "Cache-Control": "no-store" } });
}
