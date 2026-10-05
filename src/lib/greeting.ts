import { minutesNow } from "@/lib/format";

/** "Good morning", "Good afternoon" or "Good evening" at the pool, so the
 *  server and the browser agree whatever zone either is in. */
export function greeting(now: Date = new Date()): string {
  const hour = Math.floor(minutesNow(now) / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
