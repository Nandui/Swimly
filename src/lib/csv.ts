/** CSV downloads, written one way for every app.
 *
 *  A spreadsheet runs a cell that starts with =, +, - or @ as a formula, and so
 *  does one that hides it behind leading spaces, a tab or a carriage return.
 *  Names and notes are typed by people, so every cell is quoted and any that
 *  could run is opened with an apostrophe, which the spreadsheet shows as text. */

const RUNS_AS_FORMULA = /^\s*[=+\-@]|^[\t\r]/;

/** One cell: quoted, its quotes doubled, and never read as a formula. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${(RUNS_AS_FORMULA.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
}

/** Rows as CSV text: comma between cells, CRLF between rows. */
export function csvRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** A whole download: the byte-order mark Excel needs to read accented names as
 *  UTF-8, the rows, and a closing line break. */
export function csvFile(rows: readonly (readonly unknown[])[]): string {
  return `﻿${csvRows(rows)}\r\n`;
}
