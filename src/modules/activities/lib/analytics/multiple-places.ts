import type { DayOfWeek } from "@/generated/prisma/client";
import { sharedIds, type LinkedRow } from "@/modules/activities/lib/curriculum/shared";
import { courseLabel, DAY_META } from "@/modules/activities/lib/courses/constants";

export type PlaceRow = {
  studentId: string; memberNumber: string | null; firstName: string; lastName: string;
  courseId: string; courseName: string | null; courseLevelName: string; dayOfWeek: DayOfWeek; startMinutes: number;
  levelId: string; programmeId: string;
};
type Definition = LinkedRow & { name: string };

export const MULTIPLE_PLACE_KINDS = {
  classes: { label: "More than one class", noun: "class", nouns: "classes" },
  levels: { label: "More than one level", noun: "level", nouns: "levels" },
  programmes: { label: "More than one programme", noun: "programme", nouns: "programmes" },
} as const;
export type MultiplePlaceKind = keyof typeof MULTIPLE_PLACE_KINDS;

/** One row per swimmer with two or more current places at the site. Shared
 *  curriculum copies resolve to one level or programme, so a swimmer placed in
 *  the same shared level at two classes counts as one level. Two places in the
 *  same class count as two classes (repeating a level is allowed). */
export function multiplePlaces(rows: PlaceRow[], levels: Definition[], programmes: Definition[]) {
  const levelIds = sharedIds(levels), programmeIds = sharedIds(programmes);
  const levelNames = new Map(levels.map(row => [row.id, row.name]));
  const programmeNames = new Map(programmes.map(row => [row.id, row.name]));
  const swimmers = new Map<string, { id: string; memberNumber: string | null; firstName: string; lastName: string; places: PlaceRow[] }>();
  for (const row of rows) {
    const swimmer = swimmers.get(row.studentId) ?? { id: row.studentId, memberNumber: row.memberNumber, firstName: row.firstName, lastName: row.lastName, places: [] };
    swimmer.places.push(row);
    swimmers.set(row.studentId, swimmer);
  }
  const named = (ids: Set<string>, names: Map<string, string>) => [...ids].map(id => names.get(id) ?? "Unknown").sort((a, b) => a.localeCompare(b));
  const list = [...swimmers.values()].filter(swimmer => swimmer.places.length > 1).map(({ places, ...swimmer }) => {
    const ordered = places.sort((a, b) => DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index || a.startMinutes - b.startMinutes);
    return {
      ...swimmer,
      classes: ordered.map(place => courseLabel({ name: place.courseName, dayOfWeek: place.dayOfWeek, startMinutes: place.startMinutes, level: { name: place.courseLevelName } })),
      levels: named(new Set(places.map(place => levelIds.resolve(place.levelId))), levelNames),
      programmes: named(new Set(places.map(place => programmeIds.resolve(place.programmeId))), programmeNames),
    };
  }).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
  return {
    swimmers: list,
    totals: {
      classes: list.length,
      levels: list.filter(swimmer => swimmer.levels.length > 1).length,
      programmes: list.filter(swimmer => swimmer.programmes.length > 1).length,
    } satisfies Record<MultiplePlaceKind, number>,
  };
}

export type MultiplePlacesSwimmer = ReturnType<typeof multiplePlaces>["swimmers"][number];

export function matchesKind(swimmer: MultiplePlacesSwimmer, kind: MultiplePlaceKind) {
  return swimmer[kind].length > 1;
}

function csvCell(value: string | number) {
  const text = String(value);
  // A leading =, +, - or @ would run as a formula in Excel.
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}

/** Excel-friendly: BOM for UTF-8 names, CRLF rows. */
export function multiplePlacesCsv(siteName: string, swimmers: MultiplePlacesSwimmer[]) {
  const header = ["Site", "Member ID", "First name", "Last name", "Classes", "Levels", "Programmes", "Class list", "Level list", "Programme list"];
  const rows = swimmers.map(s => [siteName, s.memberNumber ?? "", s.firstName, s.lastName, s.classes.length, s.levels.length, s.programmes.length, s.classes.join("; "), s.levels.join("; "), s.programmes.join("; ")]);
  return `﻿${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
