/** In-service hours against what a qualification needs. Pure, so pages, actions and tests agree. */

export type HourTarget = { hours: number; windowMonths: number };
export type HoursEntry = { on: Date; minutes: number };

const dayOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** The first day counted: the same day `months` ago (or that month's last day). */
export function windowStart(on: Date, months: number) {
  const base = dayOnly(on);
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(base.getUTCDate(), last)));
}

/** Hours counted over the target's window up to `on`, against what it needs. */
export function hoursProgress(entries: readonly HoursEntry[], target: HourTarget, on: Date) {
  const since = windowStart(on, target.windowMonths);
  const until = dayOnly(on);
  const minutes = entries.filter((e) => e.on >= since && e.on <= until).reduce((sum, e) => sum + e.minutes, 0);
  const needed = target.hours * 60;
  return { minutes, needed, since, met: minutes >= needed, percent: Math.min(100, Math.floor((minutes / needed) * 100)) };
}

/** "1 h 30 min", "45 min", "20 h". */
export function hoursInWords(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} h` : null, m || !h ? `${m} min` : null].filter(Boolean).join(" ");
}
