/** A stand-in for `src/lib/directory.ts` in tests that fake the database.
 *
 *  Activities code reads people and sites through Core's directory rather
 *  than joining Core tables, so a test's fake Activities tables no longer need
 *  `user` or `club`. Pass the sites and people the test cares about; anything
 *  else resolves to a live site or an active person named after its id. The
 *  arrays are read on every call, so a test can archive a site mid-way. */

export type SiteDouble = { id: string; name?: string; archivedAt?: Date | null; sortOrder?: number };
export type PersonDouble = { id: string; name?: string; isActive?: boolean; permissions?: string[] };

export function directoryDouble(data: { sites?: SiteDouble[]; people?: PersonDouble[] } = {}) {
  const sites = data.sites ?? [];
  const people = data.people ?? [];
  const site = (id: string) => {
    const found = sites.find((s) => s.id === id);
    return { id, name: found?.name ?? id, archivedAt: found?.archivedAt ?? null };
  };
  const person = (id: string) => {
    const found = people.find((p) => p.id === id);
    return found?.isActive === false ? null : { id, name: found?.name ?? id };
  };
  const ids = (list: readonly (string | null | undefined)[]) => [...new Set(list.filter((id): id is string => Boolean(id)))];

  const staffByIds = async (list: readonly (string | null | undefined)[]) =>
    new Map(ids(list).flatMap((id) => { const p = person(id); return p ? [[id, p] as const] : []; }));
  const sitesByIds = async (list: readonly (string | null | undefined)[]) => new Map(ids(list).map((id) => [id, site(id)] as const));

  async function withSiteStatus<T extends Record<string, unknown>>(rows: T[], key: string, as: string) {
    return rows.map((row) => ({ ...row, [as]: site(row[key] as string) }));
  }
  async function withSites<T extends Record<string, unknown>>(rows: T[], key: string, as: string) {
    return rows.map((row) => { const s = site(row[key] as string); return { ...row, [as]: { id: s.id, name: s.name } }; });
  }
  async function withStaff<T extends Record<string, unknown>>(rows: T[], key: string, as: string) {
    return rows.map((row) => ({ ...row, [as]: row[key] ? person(row[key] as string) : null }));
  }

  return {
    staffByIds,
    sitesByIds,
    withSites,
    withSiteStatus,
    withStaff,
    withSite: async <T extends Record<string, unknown>>(row: T, key: string, as: string) => (await withSites([row], key, as))[0],
    withOneStaff: async <T extends Record<string, unknown>>(row: T, key: string, as: string) => (await withStaff([row], key, as))[0],
    isArchivedSite: async (id: string) => site(id).archivedAt !== null,
    isActiveStaff: async (id: string) => person(id) !== null,
    liveSiteIds: async () => sites.filter((s) => !s.archivedAt).map((s) => s.id),
    liveSites: async () => sites.filter((s) => !s.archivedAt).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || site(a.id).name.localeCompare(site(b.id).name)).map((s) => ({ id: s.id, name: site(s.id).name })),
    activeStaffHolding: async (permissions: readonly string[]) => people
      .filter((p) => p.isActive !== false && (p.permissions ?? []).some((key) => permissions.includes(key)))
      .map((p) => ({ id: p.id, name: p.name ?? p.id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
