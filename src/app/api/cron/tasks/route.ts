import { addDays } from "@/lib/tasks/rules";
import { ensureTasksEverywhere } from "@/lib/tasks/data";
import { today } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Makes yesterday's and today's scheduled tasks at every site (Vercel cron), so a day
 *  nobody opened still counts its missed tasks in the reports. Making them twice is
 *  harmless. Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const day = today();
  const made = await ensureTasksEverywhere([addDays(day, -1), day]);
  return Response.json({ made }, { headers: { "Cache-Control": "no-store" } });
}
