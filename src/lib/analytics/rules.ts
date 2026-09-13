import { sharedIds } from "@/lib/curriculum/shared";
import { parseDateOnly, today, toDateOnlyString } from "@/lib/format";

export function analyticsPeriod(now: Date) {
  const date = today(now);
  const day = parseDateOnly(date);
  const days = Array.from({ length: 7 }, (_, index) => toDateOnlyString(new Date(day.getTime() - (6 - index) * 86_400_000)));
  return {
    date, days, weekStart: days[0], monthStart: `${date.slice(0, 7)}-01`,
    nextMonth: toDateOnlyString(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1))),
  };
}

type Definition = { id: string; sharedWithId: string | null; name: string; sortOrder: number; archivedAt: Date | null };
export type AnalyticsProgramme = Definition;
export type AnalyticsLevel = Definition & { programmeId: string };
export type CurrentEnrolment = { studentId: string; levelId: string };
export type LevelCapacity = { levelId: string; capacity: number | null; classes: number };
export type DailyActivity = { day: string; enrolled: number; withdrawn: number };
export type CancellationTotals = { sessions: number; pending: number; notified: number; affectedPlaces: number };

export function enrolmentTotals(enrolments: CurrentEnrolment[], levels: AnalyticsLevel[], programmes: AnalyticsProgramme[], capacities: LevelCapacity[]) {
  const levelIds = sharedIds(levels), programmeIds = sharedIds(programmes);
  const swimmers = new Set<string>();
  const byLevel = new Map<string, number>();
  const capacityByLevel = new Map<string, { capacity: number | null; classes: number }>();
  for (const row of capacities) {
    const id = levelIds.resolve(row.levelId);
    const previous = capacityByLevel.get(id) ?? { capacity: 0, classes: 0 };
    capacityByLevel.set(id, {
      capacity: previous.capacity === null || row.capacity === null ? null : previous.capacity + row.capacity,
      classes: previous.classes + row.classes,
    });
  }
  for (const row of enrolments) {
    swimmers.add(row.studentId);
    const id = levelIds.resolve(row.levelId);
    // Capacity is measured in class places, so two bookings by the same
    // swimmer occupy two places even within one shared level.
    byLevel.set(id, (byLevel.get(id) ?? 0) + 1);
  }
  const ordered = programmes.filter(p => !p.sharedWithId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const groups = ordered.map(programme => ({
    id: programme.id, name: programme.name,
    levels: levels.filter(level => !level.sharedWithId && programmeIds.resolve(level.programmeId) === programme.id)
      .map(level => {
        const count = byLevel.get(level.id) ?? 0;
        const { capacity, classes } = capacityByLevel.get(level.id) ?? { capacity: 0, classes: 0 };
        return {
          id: level.id, name: level.name, count, capacity, classes,
          percentage: capacity !== null && capacity > 0 ? count / capacity * 100 : null,
          sortOrder: level.sortOrder, archived: !!(level.archivedAt || programme.archivedAt),
        };
      })
      .filter(level => !level.archived || level.count > 0 || level.classes > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  })).filter(group => group.levels.length > 0);
  return { swimmers: swimmers.size, places: enrolments.length, groups };
}

export function activityTotals(days: string[], rows: DailyActivity[]) {
  const byDay = new Map(rows.map(row => [row.day, row]));
  const daily = days.map(day => byDay.get(day) ?? { day, enrolled: 0, withdrawn: 0 });
  return { daily, enrolled: daily.reduce((sum, row) => sum + row.enrolled, 0), withdrawn: daily.reduce((sum, row) => sum + row.withdrawn, 0) };
}
