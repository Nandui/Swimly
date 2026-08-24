/** Curriculum vocabulary and the two filters every read repeats. */

/** `sortOrder` is a plain Int, not unique, so that reordering is a write per
 *  row instead of a shuffle around a temporary value. The price is that every
 *  ordering must tie-break, or a list quietly reshuffles whenever two rows
 *  share a position. Spread this into `orderBy` and nothing forgets. */
export const LIST_ORDER = [{ sortOrder: "asc" }, { name: "asc" }] as const;

/** Curriculum rows are archived, never deleted — a retired competency still
 *  has to explain the assessments made against it. Every read that means
 *  "the curriculum as it stands today" spreads this. */
export const LIVE = { archivedAt: null } as const;

/** What a level is worth saying about its size, in a sentence rather than a
 *  tile. */
export function competencyCountLabel(count: number): string {
  return `${count} ${count === 1 ? "competency" : "competencies"}`;
}

export function levelCountLabel(count: number): string {
  return `${count} ${count === 1 ? "level" : "levels"}`;
}
