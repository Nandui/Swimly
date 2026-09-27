import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDocsTestDatabase, type DocsTestDatabase } from '@/test/docs-database';
import { actor, requirements } from './domain';
import { listMembers } from './database';
import { toWorkspaceMember } from './types';

let db: DocsTestDatabase;
before(async () => { db = await createDocsTestDatabase(); });
after(async () => { await db.close(); });

const colleagues = async (viewerId: string) => {
  const viewer = await actor(db, viewerId);
  return (await listMembers(db)).map((m) => toWorkspaceMember(m, viewer));
};

test('colleagues reach the browser without permissions, screens or contact details', async () => {
  const members = await colleagues('riley');
  for (const m of members)
    assert.deepEqual(Object.keys(m).sort(), ['access', 'active', 'facilityIds', 'id', 'name', 'teamIds']);
  const serialized = JSON.stringify(members);
  for (const secret of ['permissions', 'screens', 'docs.write', 'staff.manage', '@example.invalid', 'Custom role'])
    assert.equal(serialized.includes(secret), false, `workspace payload leaked ${secret}`);
});

test('pickers still get resolved access for each colleague', async () => {
  const byId = Object.fromEntries((await colleagues('riley')).map((m) => [m.id, m.access]));
  assert.deepEqual(byId.jamie, { read: true, write: true, approve: false });
  assert.deepEqual(byId.sam, { read: true, write: true, approve: true });
  assert.deepEqual(byId.riley, { read: true, write: false, approve: false });
  assert.deepEqual(byId.outsider, { read: false, write: false, approve: false });
});

test('Docs administrators also get email and role to manage staff groups, never raw grants', async () => {
  const members = await colleagues('alex');
  const jamie = members.find((m) => m.id === 'jamie')!;
  assert.equal(jamie.email, 'jamie@example.invalid');
  assert.equal(jamie.role, 'Custom role jamie');
  assert.equal(JSON.stringify(members).includes('permissions'), false);
});

test("everyone's reading is for Docs administrators, not every author", async () => {
  await assert.rejects(requirements(db, 'jamie', true), /Reporting access requires Docs administration/);
  await assert.rejects(requirements(db, 'sam', true), /Reporting access requires Docs administration/);
  await assert.rejects(requirements(db, 'riley', true), /Reporting access/);
  assert.ok(Array.isArray(await requirements(db, 'alex', true)));
  // Anyone can still read their own requirements.
  assert.ok(Array.isArray(await requirements(db, 'jamie')));
});

test('a scoped reading report returns only the people it covers; the owner sees totals, never names', async () => {
  const { randomUUID } = await import('node:crypto');
  const { DocumentService, documentView } = await import('./domain');
  const service = new DocumentService(db);
  const content = { schemaVersion: 1 as const, title: 'Scoped report example', reference: randomUUID().slice(0, 8), type: 'SOP' as const, summary: 'Synthetic.', ownerId: 'jamie', facilityIds: [], teamIds: [], reviewDate: '2027-09-18', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fictional.' }] }] }, riskRows: [], riskMatrix: null, relatedIds: [], attachments: [] };
  const id = await service.create('jamie', content);
  const session = randomUUID();
  const draft = (await service.lock('jamie', id, session))!;
  const submission = await service.submit('jamie', id, session, draft.revision, 'sam', 'Initial');
  await service.review('sam', id, submission, 'approved', '');
  await service.assign('jamie', id, ['riley', 'alex'], [], '2026-01-01');
  // A scoped report (e.g. Riley's line manager) sees Riley only.
  const scoped = (await requirements(db, 'alex', new Set(['riley']))).filter((r) => r.documentId === id);
  assert.deepEqual(scoped.map((r) => r.memberId), ['riley']);
  // The owner gets totals; a reader gets none.
  const owner = await documentView(db, 'jamie', id);
  assert.deepEqual(owner.readingTotals, { assigned: 2, completed: 0, overdue: 2 });
  assert.equal((await documentView(db, 'riley', id)).readingTotals, null);
  assert.equal(JSON.stringify(owner.readingTotals).includes('riley'), false);
});
