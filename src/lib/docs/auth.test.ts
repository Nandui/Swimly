import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocsTestDatabase } from '@/test/docs-database';
import { serverModule } from '@/test/server-module';
import * as domain from './domain';
import { imageIds, paragraph } from './content';
import { one, type Database } from './database';
import type { DocumentContent } from './types';

let db: Database;
let user: string | null = null;
let requestHeaders = new Headers();
const revalidated: string[] = [];
before(async () => { db = await createDocsTestDatabase(); });
after(async () => { await db.close(); });
const authentication = serverModule<typeof import('./auth')>('src/lib/docs/auth.ts', {
  'server-only': {},
  '@/auth': { auth: async () => user ? { user: { id: user } } : null },
  'next/headers': { headers: async () => requestHeaders },
  'next/navigation': {
    redirect: (url: string) => { throw new Error(`redirect:${url}`); },
    notFound: () => { throw new Error('not-found'); },
  },
  './database': { database: async () => db },
  './domain': domain,
});
const actions = serverModule<typeof import('@/app/docs/actions')>('src/app/docs/actions.ts', {
  'next/cache': { revalidatePath: (path: string) => revalidated.push(path) },
  '@/lib/docs/database': { database: async () => db },
  '@/lib/docs/domain': domain,
  '@/lib/docs/auth': authentication,
  '@/lib/docs/monitoring': { reportError: async (e: unknown) => { throw e; } },
});
const content: DocumentContent = {
  schemaVersion: 1, title: 'Shared login test', reference: 'TEST-AUTH', type: 'SOP',
  summary: 'Fictional procedure', ownerId: 'jamie', facilityIds: [], teamIds: [],
  reviewDate: '2027-09-18', body: { type: 'doc', content: [paragraph('Example guidance.')] },
  riskRows: [], riskMatrix: null, relatedIds: [], attachments: [],
};

test('Docs page and actions require the existing staff session and Docs grant', async () => {
  user = null;
  await assert.rejects(authentication.requireMember(), /redirect:\/sign-in/);
  assert.deepEqual(await actions.createDocumentAction(content), { ok: false, error: 'Please sign in again.', code: 401 });
  user = 'outsider';
  await assert.rejects(authentication.requireMember(), /not-found/);
  const denied = await actions.createDocumentAction(content);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, 403);
  assert.equal((await one<{ count: number }>(db, 'SELECT count(*) FROM documents'))?.count, 0);
  assert.deepEqual(revalidated, []);
});

test('a real server action uses the signed-in staff identity and revalidates Docs', async () => {
  user = 'jamie';
  const created = await actions.createDocumentAction(content);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await one<{ createdBy: string }>(db, 'SELECT created_by FROM documents WHERE id=$1', [created.data]))?.createdBy, 'jamie');
  assert.deepEqual(revalidated, ['/docs']);
  user = 'riley';
  const denied = await actions.startDraftAction(created.data);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, 403);
});

test('private uploads require a matching request origin, including the forwarded host', async () => {
  requestHeaders = new Headers({ origin: 'https://staff.example.test', 'x-forwarded-host': 'staff.example.test', host: 'localhost:3000' });
  await authentication.assertSameOrigin();
  for (const origin of ['https://outside.example.test', 'invalid', '']) {
    requestHeaders = new Headers({ origin, host: 'staff.example.test' });
    await assert.rejects(authentication.assertSameOrigin(), /origin is not allowed/);
  }
});

test('embedded image IDs resolve beneath the integrated private file route', () => {
  assert.deepEqual(imageIds({ type: 'doc', content: [{ type: 'image', attrs: { src: '/api/docs/files/example-image', alt: 'Synthetic example' } }] }), ['example-image']);
});
