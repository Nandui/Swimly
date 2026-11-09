import { z } from "zod";
import { NOTE_KIND_META, type NoteKind } from "@/modules/hr/shared/constants";

/** The daily email of yesterday's reports (owner request, 9 November 2026:
 *  "a report of all done on the previous day per staff so I am always aware").
 *  Pure rules, kept apart from the database so they are tested on their own.
 *  It carries each report in full (owner decision, 9 November 2026). */

/** The most addresses HR > Settings sends the daily email to. */
export const MAX_DIGEST_TO = 10;

export const recipientList = (text: string) => [...new Set(String(text ?? "").split(/[\s,;]+/).map((a) => a.trim().toLowerCase()).filter(Boolean))];

/** What is wrong with the addresses, or null when they can be saved. None is allowed: nothing is sent. */
export function recipientsProblem(list: string[]): string | null {
  if (list.length > MAX_DIGEST_TO) return `Add up to ${MAX_DIGEST_TO} addresses.`;
  const wrong = list.find((a) => a.length > 254 || !z.string().email().safeParse(a).success);
  return wrong ? `"${wrong}" is not an email address. Use addresses like name@example.com.` : null;
}

export type DigestReport = {
  id: string; subjectUserId: string; subject: string; kind: string; body: string;
  occurredAt: Date; site: string; authorName: string;
};

const LONG_DAY = new Intl.DateTimeFormat("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const WHEN = new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Dublin" });

const kindLabel = (kind: string) => NOTE_KIND_META[kind as NoteKind]?.label ?? "Report";
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 good work, 2 conduct": a person's reports by kind, good work first. */
export function kindTally(reports: Pick<DigestReport, "kind">[]): string {
  const tally = new Map<string, number>();
  for (const r of reports) tally.set(r.kind, (tally.get(r.kind) ?? 0) + 1);
  return [...tally].sort(([a], [b]) => (a === "good_work" ? -1 : b === "good_work" ? 1 : a.localeCompare(b)))
    .map(([kind, n]) => `${n} ${kindLabel(kind).toLowerCase()}`).join(", ");
}

/** People in name order, each with their reports in the order they happened. */
export function byPerson(reports: DigestReport[]) {
  const people = new Map<string, { id: string; name: string; reports: DigestReport[] }>();
  for (const r of reports) {
    const person = people.get(r.subjectUserId) ?? { id: r.subjectUserId, name: r.subject, reports: [] };
    person.reports.push(r);
    people.set(r.subjectUserId, person);
  }
  return [...people.values()]
    .map((p) => ({ ...p, reports: p.reports.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The email for one day (`YYYY-MM-DD`, the Dublin day the reports were filed). */
export function digestEmail(day: string, reports: DigestReport[], origin: string) {
  const people = byPerson(reports);
  const dayLabel = LONG_DAY.format(new Date(`${day}T12:00:00Z`));
  const good = reports.filter((r) => r.kind === "good_work").length;
  const subject = `HR reports for ${dayLabel}: ${count(people.length, "person", "people")}, ${count(good, "good work")}, ${count(reports.length - good, "issue")}`;
  const lines = [
    `Reports filed in Turnfin HR on ${dayLabel}, by person.`, "",
  ];
  for (const person of people) {
    lines.push("========================================", `${person.name}: ${kindTally(person.reports)}`, "");
    for (const r of person.reports) {
      lines.push(`${kindLabel(r.kind)} · ${WHEN.format(r.occurredAt)} · ${r.site} · reported by ${r.authorName}`);
      lines.push(...r.body.replace(/\r\n?/g, "\n").split("\n").map((l) => `    ${l}`), "");
    }
    lines.push(`Open ${person.name}'s HR file: ${origin}/hr/people/${encodeURIComponent(person.id)}`, "");
  }
  lines.push("========================================",
    "You get this because your address is on the daily report list in Turnfin HR > Settings. It is confidential: please don't forward it.",
    "Opening an HR file needs a staff sign-in.");
  return { subject, text: lines.join("\r\n") };
}
