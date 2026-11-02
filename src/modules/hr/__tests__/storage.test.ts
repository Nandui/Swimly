import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { copyLegacyHr, migrateHrSchema } from '../../../../scripts/lib/hr-storage';

/** D23: the one-time copy from the separate HR database into the main
 *  database's `turnfin_hr` schema. Synthetic rows only. */
const connection = (pg: PGlite) => ({
  query: async (sql: string, params?: unknown[]) => ({ rows: (await pg.query<Record<string, unknown>>(sql, params)).rows }),
  exec: (sql: string) => pg.exec(sql),
});

test('the old HR database is copied once, with ids, sequences and the older columns, and never from another source', async () => {
  const source = new PGlite();
  const target = new PGlite();
  try {
    // The old database never got the later migrations (its last deploy failed).
    await source.exec(await readFile('hr-database/migrations/001_hr.sql', 'utf8'));
    await source.exec(`INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body, created_at)
      VALUES ('n1','org','ava','maya','Maya','record','Synthetic note', '2026-10-01T09:00:00Z'), ('n2','org','ava','maya','Maya','subject','Synthetic thanks', now());
      INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period) VALUES ('r1','org','ava','maya','Maya','2026 review');
      INSERT INTO access_events (org_id, actor_id, actor_name, subject_user_ids, entity, purpose) VALUES ('org','maya','Maya','{ava}','HrRecord','HR record'), ('org','maya','Maya','{ava}','HrRecord','HR record');
      INSERT INTO audit_events (org_id, actor_id, actor_name, action, entity, entity_id, subject_user_id, summary) VALUES ('org','maya','Maya','create','HrNote','n1','ava','Added a record note');`);
    await migrateHrSchema(connection(target));

    const copied = await copyLegacyHr(connection(source), connection(target), 'fingerprint-a');
    assert.deepEqual(copied, { alreadyImported: false, counts: { notes: 2, reviews: 1, access_events: 2, audit_events: 1 } });
    const [note] = (await target.query<{ kind: string; via: string; created_at: Date }>("SELECT kind, via, created_at FROM turnfin_hr.notes WHERE id='n1'")).rows;
    assert.deepEqual([note.kind, note.via, new Date(note.created_at).toISOString()], ['general', 'file', '2026-10-01T09:00:00.000Z'], 'later columns keep their defaults; times are kept');
    await target.query("INSERT INTO turnfin_hr.access_events (org_id, actor_id, actor_name, subject_user_ids, entity, purpose) VALUES ('org','orla','Orla','{ava}','HrRecord','HR record')");
    assert.equal((await target.query<{ id: number }>("SELECT max(id)::int AS id FROM turnfin_hr.access_events")).rows[0].id, 3, 'new log rows carry on after the copied ids');

    assert.deepEqual(await copyLegacyHr(connection(source), connection(target), 'fingerprint-a'), { alreadyImported: true, counts: { notes: 2, reviews: 1, access_events: 2, audit_events: 1 } }, 'runs once');
    await assert.rejects(copyLegacyHr(connection(source), connection(target), 'fingerprint-b'), /different source/);
  } finally { await source.close(); await target.close(); }
});

test('the copy refuses a destination that already holds HR rows of its own', async () => {
  const source = new PGlite();
  const target = new PGlite();
  try {
    await source.exec(await readFile('hr-database/migrations/001_hr.sql', 'utf8'));
    await migrateHrSchema(connection(target));
    await target.query("INSERT INTO turnfin_hr.notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ('x','org','ava','maya','Maya','record','Synthetic')");
    await assert.rejects(copyLegacyHr(connection(source), connection(target), 'fingerprint-a'), /already holds notes/);
    assert.equal((await target.query("SELECT 1 FROM turnfin_hr.storage_imports")).rows.length, 0, 'nothing recorded');
  } finally { await source.close(); await target.close(); }
});
