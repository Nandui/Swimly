import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, csvFile, csvRows } from "@/lib/csv";

test("a cell is quoted and its quotes doubled", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(12), '"12"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});

test("a cell that a spreadsheet would run is opened with an apostrophe", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  for (const risky of ["=SUM(A1)", "+1", "-1", "@cmd", " +SUM(1,2)", "\t=1", "\r=1"]) {
    assert.match(csvCell(risky), /^"'/, JSON.stringify(risky));
  }
  for (const safe of ["Ava", "10 to 12", "a=b", "half-term"]) {
    assert.doesNotMatch(csvCell(safe), /^"'/, safe);
  }
});

test("rows are joined with commas and CRLF", () => {
  assert.equal(csvRows([["Name", "Note"], ['Ava "A"', "-1"]]), "\"Name\",\"Note\"\r\n\"Ava \"\"A\"\"\",\"'-1\"");
});

test("a file opens with the byte-order mark and ends with a line break", () => {
  assert.equal(csvFile([["a"]]), '﻿"a"\r\n');
});
