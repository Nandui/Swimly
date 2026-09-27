import { runReminders } from "@/lib/staff-api/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The daily Turnfin Me reminder digest (Vercel cron). Vercel sends
 *  `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runReminders(), { headers: { "Cache-Control": "no-store" } });
}
