import { database, rows, one, listMembers } from './database';
import { actor, library, requirements } from './domain';
import type { Workspace, Group, Template, RiskMatrix } from './types';
export async function workspace(id: string): Promise<Workspace> {
  const db = await database();
  const member = await actor(db, id);
  const [members, groups, templates, matrix, documents, reading] = await Promise.all([
    listMembers(db),
    rows<Group & { kind: string }>(db, 'SELECT * FROM groups ORDER BY name'),
    rows<Template>(db, 'SELECT * FROM templates ORDER BY name'),
    one<{ value: RiskMatrix }>(db, "SELECT value FROM settings WHERE id='matrix'"),
    library(db, id),
    requirements(db, id),
  ]);
  return {
    now: new Date().toISOString(),
    member,
    // Keep bylines and historical report names even after access is revoked.
    // Assignment/owner controls and mutations independently require Docs access.
    members: members.map(m => m.id === member.id ? member : m),
    facilities: groups.filter((g) => g.kind === 'facility'),
    teams: groups.filter((g) => g.kind === 'team'),
    templates,
    matrix: matrix?.value || { configured: false, likelihood: [], severity: [], bands: [] },
    documents,
    requirements: reading,
    localMode: false,
  };
}
