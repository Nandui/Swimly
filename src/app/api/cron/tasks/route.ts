import { appRoute } from "@/lib/apps/switches";
import { ensureTasksEverywhere, freezeScores } from "@/modules/tasks/features/schedule";
import { addDaysIso, today } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nightly (Vercel cron): makes yesterday's and today's scheduled tasks at every site, so a day
 *  nobody opened still counts its missed tasks, then freezes yesterday's score at each site, so
 *  history does not move when a task is reopened later. Running it twice is harmless. Vercel
 *  sends `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
async function serveGet(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const day = today(), yesterday = addDaysIso(day, -1);
  const made = await ensureTasksEverywhere([yesterday, day]);
  const frozen = await freezeScores(yesterday);
  return Response.json({ made, frozen }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = appRoute("tasks", serveGet);
