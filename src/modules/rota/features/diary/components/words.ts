import { clock, type YoungBand } from "@/modules/rota/shared/constants";
import { duration } from "@/modules/rota/shared/shifts";
import type { Line, Need, NeedKind, PersonDay, Warning } from "@/modules/rota/features/diary/model";

/** How the diary words and colours things, in one place. */

/** The colour of what someone is on: covering an area blue, classes and activities green,
 *  bookings violet. */
export type Tone = "area" | "activity" | "booking" | "break" | "free" | "hole" | "off";
export const toneOf = (kind: NeedKind): Tone => (kind === "area" ? "area" : kind === "booking" ? "booking" : "activity");

/** Where something is: a sub-area with the area it is part of, "Pool › 25 m"; else the area. */
export const placeWords = (p: { area: string; group: string }) => (p.group && p.area ? `${p.group} › ${p.area}` : p.area);

/** What a line is called on someone's day: an area by the area ("Main pool"), anything else by
 *  what it is ("Aqua-fit", "Sharks 2"). */
export const lineTitle = (l: Pick<Line, "kind" | "area" | "title">) => (l.kind === "area" ? l.area || l.title : l.title);
/** Under it: the role for an area ("Lifeguard on duty", with the area it is part of), else where. */
export const lineWhere = (l: Pick<Line, "kind" | "area" | "title" | "group">) => (l.kind === "area" ? `${l.title}${l.group ? `, ${l.group}` : ""}` : placeWords(l));

/** A need in a few words: "Lifeguard on duty, Pool › 25 m", "Party: Murphy (Party host), Main pool". */
export const needWords = (n: Need) => `${n.title}${n.detail && n.kind === "booking" ? ` (${n.detail})` : ""}${n.area ? `, ${placeWords(n)}` : ""}`;

export const span = (s: { start: number; end: number }) => `${clock(s.start)}–${clock(s.end)}`;
export const firstName = (name: string) => name.split(" ")[0];
/** "Aoife", "Aoife and Liam", "Aoife, Liam and Niamh". */
export const listWords = (names: readonly string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function hoursWords(paid: number) {
  return `${duration(paid)} paid`;
}

/** Someone's times today: "07:00–15:00", or both stretches of a split day. */
export const partsWords = (p: PersonDay) => p.parts.map(span).join(" and ") || "Nothing yet";

/** A warning in plain words. */
export function warningWords(w: Warning, young: YoungBand | null = null) {
  switch (w.kind) {
    case "off": return "Off today, but on the plan: find cover.";
    case "overlap": return `Two things at once: also ${w.with}.`;
    case "qualification": return `${w.what} needs ${w.name}: ${w.state === "expired" ? "theirs has expired" : "they don't hold it"}.`;
    case "unplaced": return `${w.minutes} minutes of breaks still to place.`;
    case "breakCover": return `Their break is during ${w.what}: someone needs to cover it.`;
    case "young": return young === "under16" ? "Under 16: check their breaks and hours." : "Under 18: check their breaks and rest between days.";
  }
}

/** What someone does while on it: "10:30 Open the cash till · Answer the phone · 11:30 Close the cash till". */
export const subsWords = (l: Pick<Line, "subs">) => l.subs.map((x) => (x.at !== null ? `${clock(x.at)} ${x.name}` : x.name)).join(" · ");
