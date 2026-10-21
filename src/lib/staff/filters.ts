/** Search and filters on the Staff list (Admin > Staff). Pure, so the page and its tests share
 *  one reading of the address bar: `q` (name or email), `show` (who can sign in, who cannot),
 *  `role`, `site` and `department`. Unknown or empty values are dropped, so a stale link never
 *  hides everyone. */

export const STAFF_SHOW = { all: "Everyone", active: "Can sign in", inactive: "Deactivated" } as const;
export type StaffShow = keyof typeof STAFF_SHOW;

export type StaffFilters = { q: string; show: StaffShow; role: string | null; site: string | null; department: string | null };

export const STAFF_FILTER_KEYS = ["q", "show", "role", "site", "department"] as const;

/** What a filter needs from a person; the list's own rows carry more. */
export type FilterablePerson = {
  name: string;
  email: string;
  isActive: boolean;
  staffRoleId: string | null;
  /** Empty means every site, so they match whichever site is chosen. */
  siteIds: string[];
  departmentIds: string[];
};

type Raw = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function readStaffFilters(params: Raw): StaffFilters {
  const show = first(params.show);
  return {
    q: first(params.q).slice(0, 100),
    show: show in STAFF_SHOW ? (show as StaffShow) : "all",
    role: first(params.role) || null,
    site: first(params.site) || null,
    department: first(params.department) || null,
  };
}

/** The query string for these filters, without the defaults; "" when nothing is chosen. */
export function staffFiltersQuery(filters: StaffFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.show !== "all") query.set("show", filters.show);
  if (filters.role) query.set("role", filters.role);
  if (filters.site) query.set("site", filters.site);
  if (filters.department) query.set("department", filters.department);
  return query.toString();
}

export function staffListHref(filters: StaffFilters): string {
  const query = staffFiltersQuery(filters);
  return query ? `/staff?${query}` : "/staff";
}

/** A person page's way back: the list as it was left, read from its `back` parameter. Only the
 *  list's own filters survive, so the link can only ever lead to the Staff list. */
export function staffBackHref(back: string | string[] | undefined): string {
  const raw = first(back);
  if (!raw) return "/staff";
  const params = Object.fromEntries(new URLSearchParams(raw));
  return staffListHref(readStaffFilters(params));
}

export function filtersChosen(filters: StaffFilters): boolean {
  return Boolean(filters.q || filters.show !== "all" || filters.role || filters.site || filters.department);
}

/** Lower case without accents, so "sean" finds Seán and "o brien" finds Ó Briain's spelling. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Every word typed must appear in the name or email. */
export function matchesSearch(person: Pick<FilterablePerson, "name" | "email">, q: string): boolean {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(`${person.name} ${person.email}`);
  return words.every((word) => haystack.includes(word));
}

type Dimension = "show" | "role" | "site" | "department";

function matches(person: FilterablePerson, filters: StaffFilters, skip?: Dimension): boolean {
  if (!matchesSearch(person, filters.q)) return false;
  if (skip !== "show" && filters.show === "active" && !person.isActive) return false;
  if (skip !== "show" && filters.show === "inactive" && person.isActive) return false;
  if (skip !== "role" && filters.role && person.staffRoleId !== filters.role) return false;
  if (skip !== "site" && filters.site && person.siteIds.length > 0 && !person.siteIds.includes(filters.site)) return false;
  if (skip !== "department" && filters.department && !person.departmentIds.includes(filters.department)) return false;
  return true;
}

export function filterPeople<P extends FilterablePerson>(people: P[], filters: StaffFilters): P[] {
  return people.filter((person) => matches(person, filters));
}

/** How many people each choice of one filter would show, with the other filters and the search
 *  kept as they are. */
export function countBy<P extends FilterablePerson>(
  people: P[],
  filters: StaffFilters,
  dimension: Dimension,
  keyOf: (person: P) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (!matches(person, filters, dimension)) continue;
    for (const key of keyOf(person)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
