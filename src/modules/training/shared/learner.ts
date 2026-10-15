import { addDaysIso } from "@/lib/format";

/** The learner's own space (docs/training.md, e-learning phase 6): pure rules
 *  for daily refreshers, streaks, badges and search, kept apart from the
 *  database so they are tested on their own. */

// ---------------------------------------------------------------------------
// Daily refreshers: a question missed comes back, further apart each time it is right
// ---------------------------------------------------------------------------

/** Days until a card is due again, by its box (1 to 5). */
export const REFRESHER_GAPS = [1, 2, 4, 8, 16] as const;
/** Questions in a day's refresher: about two minutes. */
export const REFRESHER_DAILY = 5;

/** Where a card goes after an answer: up a box when right, back to box 1 when not. */
export function nextCard(box: number, correct: boolean, on: string) {
  const next = correct ? Math.min(REFRESHER_GAPS.length, Math.max(1, box) + 1) : 1;
  return { box: next, dueOn: addDaysIso(on, REFRESHER_GAPS[next - 1]) };
}

// ---------------------------------------------------------------------------
// Streaks: days in a row with some learning (a lesson finished or a refresher answered)
// ---------------------------------------------------------------------------

/** The current run (ending today, or yesterday while today is still open) and the best ever. */
export function streakOf(days: Iterable<string>, on: string) {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDaysIso(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  let current = 0;
  let cursor = set.has(on) ? on : addDaysIso(on, -1);
  while (set.has(cursor)) { current++; cursor = addDaysIso(cursor, -1); }
  return { current, best, today: set.has(on) };
}

// ---------------------------------------------------------------------------
// Badges: worked out from the record each time, never stored
// ---------------------------------------------------------------------------

export type LearnerStats = {
  coursesDone: number; perfectExam: boolean; firstTimePass: boolean; bestStreak: number;
  refresherAnswers: number; hoursMet: boolean; pathDone: boolean;
};

export const BADGES = [
  { id: "first-course", title: "First course", hint: "Finish your first course.", earned: (s: LearnerStats) => s.coursesDone >= 1 },
  { id: "five-courses", title: "Five courses", hint: "Finish five courses.", earned: (s: LearnerStats) => s.coursesDone >= 5 },
  { id: "ten-courses", title: "Ten courses", hint: "Finish ten courses.", earned: (s: LearnerStats) => s.coursesDone >= 10 },
  { id: "first-time", title: "First time", hint: "Pass a final exam on your first attempt.", earned: (s: LearnerStats) => s.firstTimePass },
  { id: "full-marks", title: "Full marks", hint: "Get every question right in a final exam.", earned: (s: LearnerStats) => s.perfectExam },
  { id: "streak-3", title: "Three in a row", hint: "Learn something three days in a row.", earned: (s: LearnerStats) => s.bestStreak >= 3 },
  { id: "streak-7", title: "A week in a row", hint: "Learn something seven days in a row.", earned: (s: LearnerStats) => s.bestStreak >= 7 },
  { id: "streak-30", title: "A month in a row", hint: "Learn something thirty days in a row.", earned: (s: LearnerStats) => s.bestStreak >= 30 },
  { id: "refresher-50", title: "Sharp memory", hint: "Answer 50 refresher questions.", earned: (s: LearnerStats) => s.refresherAnswers >= 50 },
  { id: "hours-met", title: "Hours done", hint: "Reach the in-service hours a qualification needs.", earned: (s: LearnerStats) => s.hoursMet },
  { id: "path-done", title: "Path finished", hint: "Finish every course on a learning path.", earned: (s: LearnerStats) => s.pathDone },
] as const;

export const badgesFor = (stats: LearnerStats) => BADGES.map((b) => ({ id: b.id, title: b.title, hint: b.hint, earned: b.earned(stats) }));

// ---------------------------------------------------------------------------
// Search: the person's own courses and lessons
// ---------------------------------------------------------------------------

/** Words of a search, lower case, with tiny ones left out. */
export const searchWords = (q: string) => [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2))].slice(0, 6);

/** How well a piece of text matches every word: 0 when one is missing. A word in the title counts more. */
export function matchScore(words: readonly string[], title: string, body: string) {
  if (!words.length) return 0;
  const t = title.toLowerCase(), b = body.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (t.includes(w)) score += 3;
    else if (b.includes(w)) score += 1;
    else return 0;
  }
  return score;
}

/** A line of the text around the first word found, for showing under a result. */
export function snippetOf(words: readonly string[], body: string, size = 140) {
  const text = body.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const at = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return text.slice(0, size) + (text.length > size ? "…" : "");
  const start = Math.max(0, at - Math.floor(size / 3));
  const end = Math.min(text.length, start + size);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
