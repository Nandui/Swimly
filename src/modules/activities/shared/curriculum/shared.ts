/** Explicit ID links preserve the original curriculum rows and their history.
 * Names never determine equivalence at runtime, so renaming a shared level
 * cannot separate swimmers from their previously earned progress. */
export type LinkedRow = { id: string; sharedWithId: string | null };

export function sharedIds(rows: LinkedRow[]) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const roots = new Map<string, string>();
  for (const row of rows) {
    let current = row;
    const seen = new Set<string>();
    while (current.sharedWithId) {
      if (seen.has(current.id)) throw new Error("The shared curriculum contains a circular link.");
      seen.add(current.id);
      const parent = byId.get(current.sharedWithId);
      if (!parent) throw new Error("A shared curriculum definition is missing.");
      current = parent;
    }
    roots.set(row.id, current.id);
  }
  const resolve = (id: string) => roots.get(id) ?? id;
  const variants = (id: string) => {
    const root = resolve(id);
    const matches = rows.filter(row => resolve(row.id) === root).map(row => row.id);
    return matches.length ? matches : [id];
  };
  return { resolve, variants };
}

/** A mark can have been recorded against either site's original copy. The
 * latest recorded judgement wins; ties are deterministic. No row is deleted. */
export function latestSharedMarks<T extends { competencyId: string; assessedOn: Date; updatedAt: Date }>(rows: T[], resolve: (id: string) => string): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const id = resolve(row.competencyId);
    const previous = latest.get(id);
    if (!previous || row.updatedAt > previous.updatedAt || (row.updatedAt.getTime() === previous.updatedAt.getTime() && row.competencyId.localeCompare(previous.competencyId) < 0)) latest.set(id, row);
  }
  return [...latest.entries()].map(([competencyId, row]) => ({ ...row, competencyId }));
}
