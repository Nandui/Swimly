/** Reordering, as a pure function so the action stays about writing.
 *
 *  Returns the ids in their new order, or null when the move is a no-op —
 *  already first and asked to go up, already last and asked to go down, or an
 *  id that is not in the list at all. The caller then writes `sortOrder = i`
 *  across the whole sibling set, which also normalises any rows that shared a
 *  position from a bulk import. */
export function reorderIds(
  ids: readonly string[],
  id: string,
  direction: "up" | "down"
): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;

  const next = [...ids];
  next[index] = ids[target];
  next[target] = ids[index];
  return next;
}
