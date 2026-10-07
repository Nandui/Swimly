import type { DayOfWeek } from "@/generated/prisma/client";
import { courseLabel, DAY_META } from "@/modules/activities/lib/courses/constants";

export type PlaceRow = {
  studentId: string; memberNumber: string | null; firstName: string; lastName: string;
  courseName: string | null; courseLevelName: string; dayOfWeek: DayOfWeek; startMinutes: number;
};

/** One row per swimmer with more than one current enrolment at the site. Two
 *  enrolments in the same class count as two (repeating a level is allowed). */
export function multiplePlaces(rows: PlaceRow[]) {
  const swimmers = new Map<string, { id: string; memberNumber: string | null; firstName: string; lastName: string; places: PlaceRow[] }>();
  for (const row of rows) {
    const swimmer = swimmers.get(row.studentId) ?? { id: row.studentId, memberNumber: row.memberNumber, firstName: row.firstName, lastName: row.lastName, places: [] };
    swimmer.places.push(row);
    swimmers.set(row.studentId, swimmer);
  }
  return [...swimmers.values()].filter(swimmer => swimmer.places.length > 1).map(({ places, ...swimmer }) => ({
    ...swimmer,
    classes: places.sort((a, b) => DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index || a.startMinutes - b.startMinutes)
      .map(place => courseLabel({ name: place.courseName, dayOfWeek: place.dayOfWeek, startMinutes: place.startMinutes, level: { name: place.courseLevelName } })),
  })).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
}

export type MultiplePlacesSwimmer = ReturnType<typeof multiplePlaces>[number];

function csvCell(value: string | number) {
  const text = String(value);
  // A leading =, +, - or @ would run as a formula in Excel.
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}

/** Excel-friendly: BOM for UTF-8 names, CRLF rows. */
export function multiplePlacesCsv(siteName: string, swimmers: MultiplePlacesSwimmer[]) {
  const header = ["Site", "Member ID", "First name", "Last name", "Enrolments", "Classes"];
  const rows = swimmers.map(s => [siteName, s.memberNumber ?? "", s.firstName, s.lastName, s.classes.length, s.classes.join("; ")]);
  return `﻿${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
