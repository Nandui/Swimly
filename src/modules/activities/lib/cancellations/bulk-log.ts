/** Cancelled classes as Legend's "Bulk Update Template - BO" (owner decision, 9 October 2026):
 *  one row for each affected member with their member number, Aquatics as the agreement and
 *  new agreement, and the programme as the agreement price and new agreement price ("Water
 *  Safety & Fun" or "Swimming Skills"). Billing fills in the rest in Legend. Pure (bulk-log.test.ts). */

/** The template's columns, in its order and spelling. */
export const BULK_LOG_COLUMNS = [
  "FirstName", "LastName", "Memberno", "Status", "Cycle Fees", "Agreement", "agreementprice", "Charge", "NewAgreement", "Newagreementprice",
  "NewCycleFee", "NewAgreementStartdate", "NewObligationDate", "NewRenewalDate", "NewLastUsageDate", "NewNextBillDate", "NewTerminationDate",
  "NewBacsCode", "NewAccountName", "NewBacsReference", "NewSortCode", "NewAccountNo", "NewMCD", "FreezeStartDate", "FreezePeriods",
  "Freeze Type", "FreezeFeeOverride", "Freeze Reason", "FreezeAllowReferralDiscounts", "FreezePreventAccess",
] as const;

export const BULK_LOG_AGREEMENT = "Aquatics";

/** Legend's price name for a swim school programme: Water Safety & Fun, or Swimming Skills
 *  for the levels. Anything else keeps its own name, so billing sees it rather than a guess. */
export function agreementPriceFor(programmeName: string) {
  const name = programmeName.toLowerCase();
  if (name.includes("water safety")) return "Water Safety & Fun";
  if (name.includes("swimming skills") || name.includes("swim skills")) return "Swimming Skills";
  return programmeName.trim();
}

export type BulkLogSwimmer = { studentId: string; firstName: string; lastName: string; memberNumber: string | null };
export type BulkLogCancellation = { programmeName: string; swimmers: readonly BulkLogSwimmer[] };

/** The sheet's rows after the header: each member once for each agreement price, however many
 *  of their classes were cancelled (Legend updates a member's agreement once), in name order.
 *  Swimmers with no member number come last, their number left empty for billing to find. */
export function bulkLogRows(cancellations: readonly BulkLogCancellation[]) {
  const rows = new Map<string, { swimmer: BulkLogSwimmer; price: string }>();
  for (const c of cancellations) {
    const price = agreementPriceFor(c.programmeName);
    for (const s of c.swimmers) {
      const key = `${s.memberNumber?.trim().toUpperCase() || s.studentId}|${price}`;
      if (!rows.has(key)) rows.set(key, { swimmer: s, price });
    }
  }
  const sorted = [...rows.values()].sort((a, b) =>
    Number(!a.swimmer.memberNumber) - Number(!b.swimmer.memberNumber)
    || a.swimmer.lastName.localeCompare(b.swimmer.lastName) || a.swimmer.firstName.localeCompare(b.swimmer.firstName));
  return sorted.map(({ swimmer, price }) => {
    const row: (string | null)[] = BULK_LOG_COLUMNS.map(() => null);
    const set = (column: (typeof BULK_LOG_COLUMNS)[number], value: string) => { row[BULK_LOG_COLUMNS.indexOf(column)] = value; };
    set("FirstName", swimmer.firstName);
    set("LastName", swimmer.lastName);
    set("Memberno", swimmer.memberNumber?.trim() ?? "");
    set("Agreement", BULK_LOG_AGREEMENT);
    set("agreementprice", price);
    set("NewAgreement", BULK_LOG_AGREEMENT);
    set("Newagreementprice", price);
    return row;
  });
}
