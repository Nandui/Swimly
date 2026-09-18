import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createDocsTestDatabase } from '@/test/docs-database';
import { docsStorageConfig } from './storage-config';
import { findMember, one } from './database';
import { DocumentService } from './domain';
import { copySharedDocs, freezeSharedDocs, migrateDocsSchema } from '../../../scripts/lib/docs-storage';
import type { DocumentContent } from './types';

test('Docs requires its own database and matching pooled/direct destinations', () => {
  const shared = 'postgresql://example:password@ep-example-pooler.example.test/shared';
  assert.throws(() => docsStorageConfig({ DATABASE_URL: shared }), /never falls back/);
  assert.throws(() => docsStorageConfig({ DATABASE_URL: shared, DOCS_DATABASE_URL: shared.replace('-pooler', '') }), /separate database/);
  assert.throws(() => docsStorageConfig({ DOCS_DATABASE_URL: shared, DOCS_DIRECT_URL: shared.replace('ep-example', 'ep-other') }), /same database/);
  assert.equal(docsStorageConfig({ DATABASE_URL: shared, DOCS_DATABASE_URL: shared.replace('/shared', '/docs') }).runtime.endsWith('/docs'), true);
});

test('Docs membership joins two isolated stores without copying staff identities', async () => {
  const db = await createDocsTestDatabase();
  try {
    assert.equal((await one(db, "SELECT to_regclass('public.\"User\"') AS account"))?.account, null);
    assert.equal((await db.identity.query<Record<string, unknown>>("SELECT to_regclass('turnfin_docs.documents') AS docs")).rows[0].docs, null);
    assert.equal((await findMember(db, 'jamie'))?.teamIds.includes('aquatics'), true);
    await db.identity.query<Record<string, unknown>>('UPDATE public."User" SET "isActive"=false WHERE id=$1', ['jamie']);
    assert.equal((await findMember(db, 'jamie'))?.active, false);
    const unavailable = { ...db, staff: { ...db.staff, find: async () => { throw new Error('Identity store unavailable'); } } };
    await assert.rejects(findMember(unavailable, 'jamie'), /Identity store unavailable/);
  } finally { await db.close(); }
});

test('storage cutover preserves documents, byte content and history, freezes old writes and is retry-safe', async () => {
  const source = await createDocsTestDatabase();
  const target = new PGlite();
  try {
    const content: DocumentContent = { schemaVersion:1,title:'Storage example',reference:'STORE-1',type:'SOP',summary:'Fictional document',ownerId:'jamie',facilityIds:[],teamIds:[],reviewDate:'2027-01-01',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Preserve this example.'}]}]},riskRows:[],riskMatrix:null,relatedIds:[],attachments:[] };
    const service = new DocumentService(source);
    const id = await service.create('jamie', content);
    const draft = (await service.lock('jamie', id, 'synthetic-session'))!;
    const submission = await service.submit('jamie', id, 'synthetic-session', draft.revision, 'sam', 'Initial publication');
    await service.review('sam', id, submission, 'approved', '');
    await source.query('INSERT INTO attachments(id,document_id,name,mime,size,storage_key,created_by) VALUES($1,$2,$3,$4,3,$1,$5)', ['file',id,'sample.pdf','application/pdf','jamie']);
    await source.query('INSERT INTO attachment_blobs VALUES($1,$2)', ['file',Buffer.from([0,128,255])]);
    await migrateDocsSchema(target);
    await migrateDocsSchema(target);
    await freezeSharedDocs(source, 'destination');
    await freezeSharedDocs(source, 'destination');
    await assert.rejects(service.create('jamie', { ...content, reference: 'AFTER-FREEZE' }), /storage has moved/);
    await assert.rejects(freezeSharedDocs(source, 'another-destination'), /another destination/);
    const result = await copySharedDocs(source, target, 'source');
    assert.equal(result.alreadyImported, false);
    assert.deepEqual((await source.query('SELECT * FROM snapshots ORDER BY id')).rows, (await target.query<Record<string, unknown>>('SELECT * FROM turnfin_docs.snapshots ORDER BY id')).rows);
    assert.deepEqual(Buffer.from((await target.query<{bytes:Uint8Array}>('SELECT bytes FROM turnfin_docs.attachment_blobs')).rows[0].bytes), Buffer.from([0,128,255]));
    assert.equal((await target.query<Record<string, unknown>>('SELECT title FROM turnfin_docs.snapshots, jsonb_to_record(content) AS x(title text) LIMIT 1')).rows[0].title, content.title);
    await target.query<Record<string, unknown>>("INSERT INTO turnfin_docs.groups VALUES('after-cutover','team','Added after cutover')");
    assert.equal((await copySharedDocs(source,target,'source')).alreadyImported,true);
    assert.equal((await target.query<Record<string, unknown>>("SELECT count(*) FROM turnfin_docs.groups WHERE id='after-cutover'")).rows[0].count,1);
    await assert.rejects(copySharedDocs(source,target,'wrong-source'), /different source/);
    await assert.rejects(target.query<Record<string, unknown>>("UPDATE turnfin_docs.snapshots SET change_summary='tampered'"), /immutable/);
  } finally { await source.close(); await target.close(); }
});

test('failed copies roll back and refuse to overwrite existing destination records', async () => {
  const source = await createDocsTestDatabase(), target = new PGlite();
  try {
    await migrateDocsSchema(target);
    const failing = { query: async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO turnfin_docs.storage_imports')) throw new Error('Synthetic connection failure');
      return target.query<Record<string, unknown>>(sql,params);
    } };
    await assert.rejects(copySharedDocs(source,failing,'source'), /Synthetic/);
    assert.equal((await target.query<Record<string, unknown>>('SELECT count(*) FROM turnfin_docs.groups')).rows[0].count,0);
    assert.equal((await target.query<Record<string, unknown>>('SELECT count(*) FROM turnfin_docs.templates')).rows[0].count,6);
    await target.query<Record<string, unknown>>("INSERT INTO turnfin_docs.groups VALUES('existing','team','Existing destination')");
    await assert.rejects(copySharedDocs(source,target,'source'), /refusing to replace/);
    assert.equal((await target.query<Record<string, unknown>>('SELECT count(*) FROM turnfin_docs.groups')).rows[0].count,1);
  } finally { await source.close(); await target.close(); }
});
