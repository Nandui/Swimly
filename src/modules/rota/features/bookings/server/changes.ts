/** What changing a booking does to its days still to come: the days it keeps, the days it no
 *  longer runs (they leave the plan) and the new days it adds. Pure, so it is tested on its own. */
export function repeatChanges(future: readonly { id: string; date: string }[], dates: readonly string[]) {
  const wanted = new Set(dates);
  const have = new Set(future.map((n) => n.date));
  return {
    keep: future.filter((n) => wanted.has(n.date)).map((n) => n.id),
    drop: future.filter((n) => !wanted.has(n.date)).map((n) => n.id),
    add: dates.filter((d) => !have.has(d)),
  };
}
