import assert from "node:assert/strict";
import { test } from "node:test";
import readXlsxFile from "read-excel-file/node";
import { writeWorkbook } from "@/lib/xlsx-write";
import { BULK_LOG_COLUMNS, agreementPriceFor, bulkLogRows, missingCycleFees } from "./bulk-log";

/** Cancelled classes as Legend's bulk update template. Invented swimmers and member numbers. */
const s = (studentId: string, firstName: string, lastName: string, memberNumber: string | null) => ({ studentId, firstName, lastName, memberNumber });
const col = (row: readonly unknown[], name: (typeof BULK_LOG_COLUMNS)[number]) => row[BULK_LOG_COLUMNS.indexOf(name)];

test("the programme gives the agreement price; anything else keeps its name", () => {
  assert.equal(agreementPriceFor("Water Safety & Fun"), "Water Safety & Fun");
  assert.equal(agreementPriceFor("Water safety and fun"), "Water Safety & Fun");
  assert.equal(agreementPriceFor("Swimming Skills"), "Swimming Skills");
  assert.equal(agreementPriceFor("Adult lessons"), "Adult lessons");
});

test("one row per member and price, Aquatics as both agreements, the rest left for billing", () => {
  const rows = bulkLogRows([
    { programmeName: "Swimming Skills", swimmers: [s("a", "Ana", "Sample", "TST001"), s("b", "Ben", "Example", null)] },
    { programmeName: "Swimming Skills", swimmers: [s("a", "Ana", "Sample", "TST001")] },
    { programmeName: "Water Safety & Fun", swimmers: [s("c", "Cai", "Example", "TST002")] },
  ]);
  assert.deepEqual(rows.map((r) => [col(r, "FirstName"), col(r, "Memberno"), col(r, "agreementprice")]), [
    ["Cai", "TST002", "Water Safety & Fun"], ["Ana", "TST001", "Swimming Skills"], ["Ben", "", "Swimming Skills"],
  ], "Ana's two cancelled classes are one row; no member number goes last");
  for (const r of rows) {
    assert.equal(col(r, "Agreement"), "Aquatics");
    assert.equal(col(r, "NewAgreement"), "Aquatics");
    assert.equal(col(r, "Newagreementprice"), col(r, "agreementprice"));
    assert.equal(col(r, "Status"), null);
  }
  assert.equal(rows[0].length, 30);
});

test("the workbook opens in a spreadsheet reader with the template's header and the rows", async () => {
  const rows = bulkLogRows([{ programmeName: "Water Safety & Fun", swimmers: [s("a", "Ana <&>", "Sample", "TST001")] }]);
  const bytes = writeWorkbook("Bulk Update Template - BO", [[...BULK_LOG_COLUMNS], ...rows]);
  // The reader gives each sheet with its rows.
  const [first] = (await readXlsxFile(bytes)) as unknown as { data: unknown[][] }[];
  const sheet = first.data;
  assert.deepEqual(sheet[0], [...BULK_LOG_COLUMNS]);
  assert.equal(sheet[1][0], "Ana <&>");
  assert.equal(sheet[1][2], "TST001");
  assert.equal(sheet[1][6], "Water Safety & Fun");
});

test("the restore export puts each agreement price's monthly price in NewCycleFee, in euros", () => {
  const cancellations = [
    { programmeName: "Swimming Skills", swimmers: [s("a", "Ana", "Sample", "TST001")] },
    { programmeName: "Water Safety & Fun", swimmers: [s("c", "Cai", "Example", "TST002")] },
  ];
  const fees = new Map<string, number | null>([["Swimming Skills", 4550], ["Water Safety & Fun", null]]);
  const rows = bulkLogRows(cancellations, { cycleFees: fees });
  assert.equal(col(rows.find((r) => col(r, "FirstName") === "Ana")!, "NewCycleFee"), 45.5);
  assert.equal(col(rows.find((r) => col(r, "FirstName") === "Cai")!, "NewCycleFee"), null, "no price yet: left empty");
  assert.deepEqual(missingCycleFees(cancellations, fees), ["Water Safety & Fun"]);
  assert.equal(col(bulkLogRows(cancellations)[0], "NewCycleFee"), null, "the first export never sets it");
});
