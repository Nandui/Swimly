/** The progression rules, as pure functions.
 *
 *  Nothing here reads or writes. Every screen that asks "can she move up?",
 *  "has he finished?", "is this placement out of sequence?" asks it here, so
 *  there is exactly one answer in the app rather than one per page. */

export type OrderedLevel = { id: string; name: string; sortOrder: number };

/** Has this student earned a place at `targetLevelId`?
 *
 *  Deliberately forgiving in one specific way: it looks at the *previous live
 *  level*, not at every level below. The stricter reading would un-earn a
 *  whole cohort the moment somebody inserts a level underneath them, which is
 *  a curriculum edit rather than anything the swimmers did. */
export function hasEarnedPlace(args: {
  targetLevelId: string;
  /** Live levels of the target's programme, already in order. */
  orderedLevels: readonly OrderedLevel[];
  completedLevelIds: ReadonlySet<string>;
  activeLevelIds: ReadonlySet<string>;
  /** Levels an assessor has placed this swimmer at, in this programme. An
   *  assessment earns that level and every level below it — a child assessed
   *  as Turtles may be put in Penguins if that suits the family better, and
   *  nobody should have to write a reason for placing them lower than they
   *  were judged. */
  assessedLevelIds?: ReadonlySet<string>;
}): boolean {
  const { targetLevelId, orderedLevels, completedLevelIds, activeLevelIds, assessedLevelIds } =
    args;

  // Repeating a level is ordinary, and so is a second class at the level you
  // are already in.
  if (completedLevelIds.has(targetLevelId)) return true;
  if (activeLevelIds.has(targetLevelId)) return true;

  const index = orderedLevels.findIndex((level) => level.id === targetLevelId);
  // The entry level is earned by turning up. An unknown level (archived, say)
  // is not something to block on either — the course form already refuses to
  // teach one.
  if (index <= 0) return true;

  if (assessedLevelIds?.size) {
    const highestAssessed = Math.max(
      ...orderedLevels.map((level, i) => (assessedLevelIds.has(level.id) ? i : -1))
    );
    if (highestAssessed >= index) return true;
  }

  return completedLevelIds.has(orderedLevels[index - 1].id);
}

/** The level immediately below the target, for the sentence that explains a
 *  placement warning. */
export function previousLevel(
  targetLevelId: string,
  orderedLevels: readonly OrderedLevel[]
): OrderedLevel | null {
  const index = orderedLevels.findIndex((level) => level.id === targetLevelId);
  return index > 0 ? orderedLevels[index - 1] : null;
}

export type CompletionProgress = {
  achieved: number;
  total: number;
  /** Every live competency signed off. What makes the confirm button live. */
  eligible: boolean;
};

/** How far through a level a student is. A level with no competencies yet is
 *  not "complete" — it is a level nobody has written the requirements for, and
 *  saying otherwise would let an empty curriculum graduate the whole club. */
export function completionProgress(
  liveCompetencyIds: readonly string[],
  achievedCompetencyIds: ReadonlySet<string>
): CompletionProgress {
  const total = liveCompetencyIds.length;
  const achieved = liveCompetencyIds.filter((id) => achievedCompetencyIds.has(id)).length;
  return { achieved, total, eligible: total > 0 && achieved === total };
}

/** Out the far end: every live level in the programme completed. */
export function hasGraduated(
  orderedLevels: readonly OrderedLevel[],
  completedLevelIds: ReadonlySet<string>
): boolean {
  if (orderedLevels.length === 0) return false;
  return orderedLevels.every((level) => completedLevelIds.has(level.id));
}

/** The next level up, once this one is done — null at the top of the ladder.
 *  Generic in the level shape, because the list is already in order and only
 *  the id is read: callers pass whatever they already have in hand. */
export function nextLevel<T extends { id: string }>(
  levelId: string,
  orderedLevels: readonly T[]
): T | null {
  const index = orderedLevels.findIndex((level) => level.id === levelId);
  if (index === -1 || index === orderedLevels.length - 1) return null;
  return orderedLevels[index + 1];
}
