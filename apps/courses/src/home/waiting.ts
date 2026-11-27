/** Who is waiting for a class place. Pure: the reads are in ./data.ts.
 *
 *  The rule is the swim school's own, carried over unchanged from Turnfin's "Awaiting
 *  enrolment" so the two agree while both run on the same records:
 *
 *  - A swimmer is waiting in a programme once an assessment placed them at a level, or the desk
 *    added them by hand. The latest such reason for a swimmer and programme is the one that
 *    counts, and it counts at the site it happened at.
 *  - They stop waiting when they get a class place in that programme: an active place, or one
 *    that started or ended on or after the day they began waiting. A waiting-list entry is
 *    not a place, and neither is a waiting-list entry that was withdrawn without ever
 *    becoming one.
 *  - A swimmer on a class's waiting list is waiting too, whether or not an assessment put
 *    them there.
 *
 *  Programmes shared between sites are one programme: `programmeOf` gives the shared one. */

export type Place = { id: string; programmeId: string; status: string; startedOn: Date; endedOn: Date | null };

/** An assessment that placed a swimmer, or a swimmer the desk added by hand. */
export type Reason = {
  id: string;
  studentId: string;
  siteId: string;
  programmeId: string;
  /** The day they began waiting. */
  queuedOn: Date;
  /** Breaks ties between reasons on the same day: later wins. */
  order: readonly [number, number];
  places: readonly Place[];
};

export type WaitingListEntry = { studentId: string; programmeId: string };

export type WaitingInput = {
  reasons: readonly Reason[];
  waitingLists: readonly WaitingListEntry[];
  /** The person's sites; null means every site. */
  siteIds: ReadonlySet<string> | null;
  programmeOf: (programmeId: string) => string;
  /** Withdrawn places that began as a waiting-list entry, and those that were ever a real place. */
  beganAsWaitingList: ReadonlySet<string>;
  everAPlace: ReadonlySet<string>;
};

/** One key per swimmer and programme still waiting. */
export function waiting(input: WaitingInput): Set<string> {
  const { programmeOf } = input;
  const latestFirst = [...input.reasons].sort((a, b) =>
    b.queuedOn.getTime() - a.queuedOn.getTime() || b.order[0] - a.order[0] || b.order[1] - a.order[1] || b.id.localeCompare(a.id));
  const seen = new Set<string>();
  const keys = new Set<string>();
  for (const reason of latestFirst) {
    const programme = programmeOf(reason.programmeId);
    const key = `${reason.studentId}:${programme}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (input.siteIds && !input.siteIds.has(reason.siteId)) continue;
    const placed = reason.places.some((place) => {
      if (programmeOf(place.programmeId) !== programme || place.status === "WAITLISTED") return false;
      if (place.status === "ACTIVE") return true;
      if (input.beganAsWaitingList.has(place.id) && !input.everAPlace.has(place.id)) return false;
      return place.startedOn >= reason.queuedOn || (place.endedOn !== null && place.endedOn >= reason.queuedOn);
    });
    if (!placed) keys.add(key);
  }
  for (const entry of input.waitingLists) keys.add(`${entry.studentId}:${programmeOf(entry.programmeId)}`);
  return keys;
}

/** Rows that can stand in for one another across sites, back to the one they all share. */
export function sharedRoots(rows: readonly { id: string; sharedWithId: string | null }[]): (id: string) => string {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots = new Map<string, string>();
  for (const row of rows) {
    let current = row;
    const visited = new Set<string>();
    while (current.sharedWithId) {
      if (visited.has(current.id)) throw new Error("The shared curriculum contains a circular link.");
      visited.add(current.id);
      const parent = byId.get(current.sharedWithId);
      if (!parent) throw new Error("A shared curriculum definition is missing.");
      current = parent;
    }
    roots.set(row.id, current.id);
  }
  return (id) => roots.get(id) ?? id;
}
