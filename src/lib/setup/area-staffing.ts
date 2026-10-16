/** Words for an area's minimum staff (Admin, Areas), shared by the page and its dialog. */

type Minimum = { count: number; typeId: string | null; typeName: string | null };

/** 420 as "07:00"; null as empty. */
export const hhmm = (minutes: number | null) => (minutes === null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);

/** "At least 2 NPLQ and 1 anyone · open 07:00 to 22:00", or null with no minimum. */
export function staffingWords(area: { minimums: Minimum[]; openFrom: number | null; openUntil: number | null }) {
  if (!area.minimums.length) return null;
  const lines = area.minimums.map((m) => `${m.count} ${m.typeId ? m.typeName ?? "qualified" : "anyone"}`);
  const list = lines.length > 1 ? `${lines.slice(0, -1).join(", ")} and ${lines[lines.length - 1]}` : lines[0];
  return `At least ${list}${area.openFrom !== null && area.openUntil !== null ? ` · open ${hhmm(area.openFrom)} to ${hhmm(area.openUntil)}` : " while in use"}`;
}
