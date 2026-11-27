/** A page that is still Turnfin's. Until Courses has its own page for a job, the job opens
 *  where it lives today, on the same records (docs/courses.md, The order). Null when Courses
 *  does not know where Turnfin is: the thing is then shown without a link. */
export function inTurnfin(path: string, env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.TURNFIN_URL;
  if (!raw || !path.startsWith("/")) return null;
  try {
    return new URL(path, raw).toString();
  } catch {
    return null;
  }
}
