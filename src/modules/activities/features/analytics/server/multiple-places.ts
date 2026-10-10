import type { DayOfWeek } from "@/generated/prisma/client";
import { courseLabel, DAY_META } from "@/modules/activities/shared/courses/constants";

export type PlaceRow = {
  studentId: string; memberNumber: string | null; firstName: string; lastName: string;
  courseName: string | null; courseLevelName: string; dayOfWeek: DayOfWeek; startMinutes: number;
  siteName: string; siteOrder: number; waitlisted: boolean;
};

/** One row per swimmer with more than one enrolment, waitlist places
 *  included, across whichever sites the rows cover. Two enrolments in the same
 *  class count as two (repeating a level is allowed). */
export function multiplePlaces(rows: PlaceRow[]) {
  const swimmers = new Map<string, { id: string; memberNumber: string | null; firstName: string; lastName: string; places: PlaceRow[] }>();
  for (const row of rows) {
    const swimmer = swimmers.get(row.studentId) ?? { id: row.studentId, memberNumber: row.memberNumber, firstName: row.firstName, lastName: row.lastName, places: [] };
    swimmer.places.push(row);
    swimmers.set(row.studentId, swimmer);
  }
  return [...swimmers.values()].filter(swimmer => swimmer.places.length > 1).map(({ places, ...swimmer }) => {
    const ordered = places.sort((a, b) => a.siteOrder - b.siteOrder || a.siteName.localeCompare(b.siteName)
      || DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index || a.startMinutes - b.startMinutes);
    return {
      ...swimmer,
      sites: [...new Set(ordered.map(place => place.siteName))],
      waitlisted: places.filter(place => place.waitlisted).length,
      classes: ordered.map(place => ({
        label: courseLabel({ name: place.courseName, dayOfWeek: place.dayOfWeek, startMinutes: place.startMinutes, level: { name: place.courseLevelName } }),
        site: place.siteName, waitlisted: place.waitlisted,
      })),
    };
  }).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
}

export type MultiplePlacesSwimmer = ReturnType<typeof multiplePlaces>[number];

function csvCell(value: string | number) {
  const text = String(value);
  // A leading =, +, - or @ would run as a formula in Excel.
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}

/** Excel-friendly: BOM for UTF-8 names, CRLF rows. */
export function multiplePlacesCsv(swimmers: MultiplePlacesSwimmer[]) {
  const header = ["Member ID", "First name", "Last name", "Sites", "Enrolments", "Waitlisted", "Classes"];
  const rows = swimmers.map(s => [s.memberNumber ?? "", s.firstName, s.lastName, s.sites.join("; "), s.classes.length, s.waitlisted,
    s.classes.map(c => `${c.label} · ${c.site}${c.waitlisted ? " (waitlisted)" : ""}`).join("; ")]);
  return `﻿${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
