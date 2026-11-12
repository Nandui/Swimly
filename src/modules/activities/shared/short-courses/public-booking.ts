import { randomInt } from "node:crypto";

/** Places held for payment (owner decision, 8 October 2026): a place held in the parents app (or,
 *  before 21 October 2026, online) is owed, and the desk phones within 72 hours to take payment. */

/** Hours from holding a place to the call for payment. */
export const ONLINE_HOLD_HOURS = 72;
export const holdDeadline = (heldAt: Date) => new Date(heldAt.getTime() + ONLINE_HOLD_HOURS * 3_600_000);

const REFERENCE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** A booking reference, "AC-4K8PZ": no 0/O or 1/I to misread over the phone. */
export const newReference = (prefix: string) => `${prefix}-${Array.from({ length: 5 }, () => REFERENCE_LETTERS[randomInt(0, REFERENCE_LETTERS.length)]).join("")}`;

const WHEN = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const parts = (f: Intl.DateTimeFormat, d: Date) => (t: string) => f.formatToParts(d).find((x) => x.type === t)?.value ?? "";
/** "Sat 7 Nov, 14:05" in Dublin time. */
export function whenWords(d: Date) { const p = parts(WHEN, d); return `${p("weekday")} ${p("day")} ${p("month")}, ${p("hour")}:${p("minute")}`; }

const DUBLIN_TIME = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hour12: false });
const DUBLIN_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" });

/** How soon the desk must phone about a place held online: past the deadline, within a day, or
 *  later, and how to say it after "Phone by": "today 21:10", "tomorrow 09:00", "Fri 9 Oct, 14:00",
 *  or "Overdue by 6 h". */
export function callDue(callBy: Date, now: Date = new Date()): { due: "overdue" | "soon" | "later"; label: string } {
  const left = callBy.getTime() - now.getTime();
  if (left <= 0) {
    const hours = Math.floor(-left / 3_600_000);
    return { due: "overdue", label: hours < 1 ? "Overdue" : hours < 48 ? `Overdue by ${hours} h` : `Overdue by ${Math.floor(hours / 24)} days` };
  }
  const time = DUBLIN_TIME.format(callBy);
  const day = DUBLIN_ISO.format(callBy);
  const label = day === DUBLIN_ISO.format(now) ? `today ${time}` : day === DUBLIN_ISO.format(new Date(now.getTime() + 86_400_000)) ? `tomorrow ${time}` : whenWords(callBy);
  return { due: left <= 86_400_000 ? "soon" : "later", label };
}
