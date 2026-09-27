import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDocsTestDatabase, type DocsTestDatabase } from '@/test/docs-database';
import { DocumentService, syncPlatformGroups } from './domain';
import { listMembers, rows, type Database, type StaffDirectory } from './database';

/** One organisation chart: platform sites and departments appear in Docs with
 *  their own ids, and membership follows the Staff profile. */
let db: DocsTestDatabase;
let platform: Database;
before(async () => {
  db = await createDocsTestDatabase();
  const staff: StaffDirectory = {
    find: async (id) => { const p = await db.staff.find(id); return p && (id === 'riley' ? { ...p, siteIds: ['club_churchfield'], departmentIds: ['dept_aquatics'] } : p); },
    list: async () => (await db.staff.list()).map((p) => (p.id === 'riley' ? { ...p, siteIds: ['club_churchfield'], departmentIds: ['dept_aquatics'] } : p)),
    organisation: async () => ({ sites: [{ id: 'club_churchfield', name: 'LeisureWorld Churchfield' }], departments: [{ id: 'dept_aquatics', name: 'Aquatics' }] }),
  };
  platform = { ...db, staff, transaction: (fn) => db.transaction((tx) => fn({ ...tx, staff, query: tx.query.bind(tx) })) };
});
after(async () => { await db.close(); });

test('platform sites and departments become Docs groups; a same-named Docs group keeps its id', async () => {
  // The fixture already has a Docs-only team called "Aquatics" (id 'aquatics').
  await platform.transaction(syncPlatformGroups);
  await platform.transaction(syncPlatformGroups); // idempotent
  const groups = await rows<{ id: string; kind: string; name: string; source: string }>(db, 'SELECT id,kind,name,source FROM groups ORDER BY id');
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  assert.deepEqual(byId.dept_aquatics, { id: 'dept_aquatics', kind: 'team', name: 'Aquatics', source: 'platform' });
  assert.deepEqual(byId.club_churchfield, { id: 'club_churchfield', kind: 'facility', name: 'LeisureWorld Churchfield', source: 'platform' });
  assert.deepEqual(byId.aquatics, { id: 'aquatics', kind: 'team', name: 'Aquatics (Docs group)', source: 'docs' });
});

test('membership merges Docs-only groups with the Staff profile, and platform ids are never stored', async () => {
  const riley = (await listMembers(platform)).find((m) => m.id === 'riley')!;
  assert.ok(riley.teamIds.includes('dept_aquatics') && riley.teamIds.includes('aquatics'));
  assert.ok(riley.facilityIds.includes('club_churchfield'));
  await new DocumentService(platform).saveMember('alex', { id: 'riley', facilityIds: ['harbour', 'club_churchfield'], teamIds: ['dept_aquatics'] });
  const stored = (await rows<{ facilityIds: string[]; teamIds: string[] }>(db, "SELECT facility_ids, team_ids FROM member_profiles WHERE id='riley'"))[0];
  assert.deepEqual(stored, { facilityIds: ['harbour'], teamIds: [] });
});

test('platform groups cannot be renamed from Docs', async () => {
  await assert.rejects(new DocumentService(platform).saveGroup('alex', 'team', 'Renamed', 'dept_aquatics'), /managed in Staff/);
});
