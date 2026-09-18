import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { Database } from '@/lib/docs/database';
import type { RiskMatrix } from '@/lib/docs/types';

export const demoMatrix: RiskMatrix = {
  configured: true,
  likelihood: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'].map(label => ({ label, description: 'Synthetic likelihood definition.' })),
  severity: ['Minor', 'Moderate', 'Significant', 'Major', 'Severe'].map(label => ({ label, description: 'Synthetic severity definition.' })),
  bands: [
    { label: 'Low', min: 1, max: 4, color: 'green' }, { label: 'Moderate', min: 5, max: 9, color: 'amber' },
    { label: 'High', min: 10, max: 16, color: 'orange' }, { label: 'Very high', min: 17, max: 25, color: 'red' },
  ],
};

/** Isolated PostgreSQL engine. Does not read credentials or connect to the app DB. */
export async function createDocsTestDatabase(): Promise<Database> {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE public."StaffRole" (id text PRIMARY KEY, name text, permissions text[], screens text[]);
    CREATE TABLE public."User" (id text PRIMARY KEY, name text, email text, "isActive" boolean, "staffRoleId" text REFERENCES public."StaffRole");`);
  await pg.exec(await readFile('prisma/migrations/20260918120000_turnfin_docs/migration.sql', 'utf8'));
  await pg.exec('SET search_path=turnfin_docs,public');
  const db: Database = {
    query: (sql, params) => pg.query(sql, params),
    transaction: fn => pg.transaction(async tx => {
      await tx.query('SELECT id FROM workspace_lock WHERE id=1 FOR UPDATE');
      return fn(tx);
    }),
    close: () => pg.close(),
  };
  const users = [
    ['alex', 'Alex Example', ['staff.manage', 'roles.manage']],
    ['jamie', 'Jamie Example', ['docs.write']],
    ['sam', 'Sam Example', ['docs.approve']],
    ['riley', 'Riley Example', ['docs.read']],
    ['outsider', 'Outside Example', []],
  ] as const;
  for (const [id, name, permissions] of users) {
    await db.query('INSERT INTO public."StaffRole" VALUES($1,$2,$3,$4)', [id, 'Custom role ' + id, [...permissions], id === 'outsider' ? [] : ['docs']]);
    await db.query('INSERT INTO public."User" VALUES($1,$2,$3,true,$1)', [id, name, id+'@example.invalid']);
    await db.query('INSERT INTO member_profiles(id,facility_ids,team_ids) VALUES($1,$2,$3)', [id, ['harbour'], id === 'alex' ? ['management'] : ['aquatics']]);
  }
  await db.query("INSERT INTO groups VALUES('harbour','facility','Example site'),('aquatics','team','Aquatics'),('operations','team','Operations'),('management','team','Management')");
  await db.query("INSERT INTO settings VALUES('matrix',$1)", [JSON.stringify(demoMatrix)]);
  return db;
}
