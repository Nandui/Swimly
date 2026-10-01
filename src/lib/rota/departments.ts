/** The payroll system's department codes (its Dept list, October 2026), so a
 *  roster upload needs nothing but the file. Each code names its place: BT is
 *  Bishopstown, CF Churchfield; DO, Mahon and SPC are LeisureWorld places
 *  outside Turnfin unless a site with that name is added. The rota shows the
 *  name without the place, since the site is shown beside it. Pure and tested. */

export type RosterPlace = "BT" | "CF" | "DO" | "Mahon" | "SPC";

/** What each place's site is called, matched against the site names in Turnfin. */
export const PLACE_SITE_NAMES: Record<RosterPlace, readonly string[]> = {
  BT: ["Bishopstown"],
  CF: ["Churchfield"],
  DO: ["Douglas"],
  Mahon: ["Mahon"],
  SPC: ["SPC", "St Patrick"],
};

const LIST = `
010 BT Accounts|020 BT Admin|030 BT Aerobics < 10|040 BT Aerobics > 10|050 BT Training External|060 BT Cafe|070 BT Camps|080 BT Health & Fitness
100 BT Pool|110 BT Maintenance|150 BT School Lessons|180 BT Pitches|190 BT Plant|200 BT Reception|201 BT Switchboard|210 BT Duty Manager
220 BT Senior Duty Manager|230 BT Parties|271 BT Private Lessons|310 BT Training Internal|320 CF Aerobics < 10|330 CF Aerobics > 10
340 CF Training External|350 CF Camps|360 CF Health & Fitness|401 BT Head Office|410 CF School Lessons|440 CF Pitches|450 CF Plant
460 CF Reception|461 CF Switchboard|470 CF Duty Manager|480 CF Senior Duty Manager|490 CF Parties|510 CF Maintenance|520 CF Pool
540 CF Training Internal|561 CF Private Lessons|600 BT Tutor|601 CF Tutor|602 DO Tutor|710 Mahon Reception|711 Mahon Senior Duty Manager
713 Mahon Training External|720 SPC Tutor|721 SPC Training Internal|722 SPC Shift Supervisor|723 SPC Café|730 DO Pool|744 DO Private Lessons
760 DO Duty Manager|761 DO Senior Duty Manager|762 DO Training Internal|763 DO Training External|764 Supervisor|765 Shift Supervisor`;

export const ROSTER_DEPARTMENTS: ReadonlyMap<string, { label: string; place: RosterPlace | null }> = new Map(
  LIST.split(/[|\n]/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const [, code, rest] = /^(\d{3})\s+(.+)$/.exec(line)!;
    const place = /^(BT|CF|DO|Mahon|SPC)\s+(.+)$/.exec(rest);
    return [code, place ? { label: place[2], place: place[1] as RosterPlace } : { label: rest, place: null }];
  }),
);

/** A code's name and place. A code missing from the list still has a place by
 *  its number: Bishopstown's run below 320, Churchfield's from 320 to 599. */
export function rosterDepartment(code: string): { label: string; place: RosterPlace | null } {
  const known = ROSTER_DEPARTMENTS.get(code.padStart(3, "0"));
  if (known) return known;
  const n = Number(code);
  const place: RosterPlace | null = !Number.isInteger(n) ? null : n < 320 ? "BT" : n < 600 ? "CF" : null;
  return { label: `Department ${code}`, place };
}

/** The open site in Turnfin for a place, by name; null when it has none. */
export function siteForPlace<S extends { name: string }>(place: RosterPlace | null, sites: readonly S[]): S | null {
  if (!place) return null;
  const names = PLACE_SITE_NAMES[place].map((n) => n.toLowerCase());
  const matches = sites.filter((s) => names.some((n) => s.name.toLowerCase().includes(n)));
  // "Churchfield" over "Churchfield Annex" when both match.
  return [...matches].sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}
