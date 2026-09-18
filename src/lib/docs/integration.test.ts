import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDocsTestDatabase } from '@/test/docs-database';
import { cleanScreens, homePathFor } from '@/lib/staff/screens';
import { actor, DocumentService, library } from './domain';
import { type Database, one, rows } from './database';
import { canManage, canApprove, type DocumentContent } from './types';
import { uploadFile, readAttachment, validateFile } from './files';
let db: Database;
before(async () => { db = await createDocsTestDatabase(); });
after(async () => { await db.close(); });
const content = (): DocumentContent => ({ schemaVersion: 1, title: 'Example procedure', reference: randomUUID(), type: 'SOP', summary: 'Synthetic document for verification.', ownerId: 'jamie', facilityIds: [], teamIds: [], reviewDate: '2027-09-18', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fictional test guidance.' }] }] }, riskRows: [], riskMatrix: null, relatedIds: [], attachments: [] });

test('renaming a role Administrator grants nothing; global administrator receives Docs automatically', async () => {
  await db.query('UPDATE public."StaffRole" SET name=$1 WHERE id=$2', ['Administrator', 'outsider']);
  await assert.rejects(library(db, 'outsider'), /Docs access/);
  const m = await actor(db, 'alex');
  assert.equal(canManage(m), true);
  assert.equal(canApprove(m), true);
});
test('current staff permissions and deactivation are checked on every operation', async () => {
  await db.query('UPDATE public."User" SET "isActive"=false WHERE id=$1', ['riley']);
  await assert.rejects(library(db, 'riley'), /active staff/);
  await db.query('UPDATE public."User" SET "isActive"=true WHERE id=$1', ['riley']);
  await db.query('UPDATE public."StaffRole" SET screens=$1 WHERE id=$2', [[], 'riley']);
  await assert.rejects(library(db, 'riley'), /Docs access/);
  await db.query('UPDATE public."StaffRole" SET screens=$1 WHERE id=$2', [['docs'], 'riley']);
  await library(db, 'riley');
});
test('effective role preview cannot use the real administrator grants', async () => {
  const access = { id: 'alex', permissions: ['docs.read'], screens: ['docs'] };
  const preview: Database = { ...db, access, transaction: fn => db.transaction(tx => fn({ ...tx, query: tx.query.bind(tx), access })) };
  await assert.rejects(new DocumentService(preview).create('alex', content()), /authoring permission/);
  assert.equal(canManage(await actor(preview, 'alex')), false);
});
test('a stale session does not restore grants removed in the shared staff role', async () => {
  const access = { id: 'jamie', permissions: ['docs.write'], screens: ['docs'] };
  const stale: Database = { ...db, access, transaction: fn => db.transaction(tx => fn({ ...tx, query: tx.query.bind(tx), access })) };
  await db.query('UPDATE public."StaffRole" SET permissions=$1 WHERE id=$2', [['docs.read'], 'jamie']);
  await assert.rejects(new DocumentService(stale).create('jamie', content()), /authoring permission/);
  await db.query('UPDATE public."StaffRole" SET permissions=$1 WHERE id=$2', [['docs.write'], 'jamie']);
});
test('Docs administration cannot edit shared accounts or escalate their permissions', async () => {
  const m = await actor(db, 'riley');
  const forged = { ...m, name: 'Tampered', role: 'Administrator', permissions: ['staff.manage', 'roles.manage'], active: false, teamIds: [] };
  await new DocumentService(db).saveMember('alex', forged);
  const current = await actor(db, 'riley');
  assert.equal(current.name, m.name);
  assert.deepEqual(current.permissions, ['docs.read']);
  assert.equal(current.active, true);
});
test('Docs access preserves the Instructor and desk workspace boundaries', () => {
  assert.deepEqual(cleanScreens(['today', 'docs']), ['instructor', 'docs']);
  assert.equal(homePathFor('calendar', ['docs.read'], ['docs']), '/docs');
  assert.equal(homePathFor('instructor', ['attendance.mark', 'docs.read'], ['instructor', 'docs'], 'desk'), '/account');
});
test('private file bytes are atomic, inaccessible before publication, then readable with Docs access', async () => {
  const service = new DocumentService(db), c = content(), session = randomUUID();
  const id = await service.create('jamie', c), draft = (await service.lock('jamie', id, session))!;
  const file = new File(['%PDF-1.4\nSynthetic test attachment'], 'example.pdf', { type: 'application/pdf' });
  await assert.rejects(uploadFile('riley', id, session, file, db), /Author access/);
  const attachment = await uploadFile('jamie', id, session, file, db);
  await assert.rejects(readAttachment('riley', attachment.id, db), /File not found/);
  await assert.rejects(readAttachment('outsider', attachment.id, db), /Docs access/);
  const saved = await service.save('jamie', id, session, draft.revision, { ...c, attachments: [attachment] });
  const submission = await service.submit('jamie', id, session, saved.revision, 'sam', 'Approved attachment');
  await service.review('sam', id, submission, 'approved', '');
  assert.equal((await readAttachment('riley', attachment.id, db)).bytes.toString(), await file.text());
  const events = await rows<{ action: string }>(db, 'SELECT action FROM audit_events WHERE document_id=$1', [id]);
  for (const action of ['created', 'editing_session', 'file_uploaded', 'draft_saved', 'submitted', 'published']) assert.ok(events.some(e => e.action === action), action);
  await assert.rejects(db.query('UPDATE attachment_blobs SET bytes=$2 WHERE id=$1', [attachment.id, Buffer.from('tamper')]), /immutable/);
});
test('failed private upload rolls back both metadata and bytes; types and size are validated', async () => {
  const service = new DocumentService(db), session = randomUUID();
  const id = await service.create('jamie', content());
  await service.lock('jamie', id, session);
  const failing: Database = { ...db, transaction: fn => db.transaction(tx => fn({ ...tx, query: async (sql, params) => {
    if (sql.startsWith('INSERT INTO audit_events')) throw new Error('Synthetic audit failure');
    return tx.query(sql, params);
  } })) };
  await assert.rejects(uploadFile('jamie', id, session, new File(['%PDF-1.4'], 'example.pdf', { type: 'application/pdf' }), failing), /audit failure/);
  assert.equal((await one<{ count: string }>(db, 'SELECT count(*) FROM attachments WHERE document_id=$1', [id]))?.count, 0);
  assert.throws(() => validateFile('fake.pdf', 'application/pdf', Buffer.from('bad')), /must match/);
  assert.throws(() => validateFile('large.pdf', 'application/pdf', Buffer.alloc(4 * 1024 * 1024 + 1)), /4 MB/);
});
