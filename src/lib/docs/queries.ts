import { database, rows, one, listMembers } from './database';
import { actor, library, requirements, syncPlatformGroups } from './domain';
import { readingReportScope } from './report-scope';
import { toWorkspaceMember, type Workspace, type Group, type Template, type RiskMatrix } from './types';
export async function workspace(id: string): Promise<Workspace> {
  const db = await database();
  const member = await actor(db, id);
  // Keep Docs' groups in step with the platform's sites and departments.
  await db.transaction(syncPlatformGroups);
  const [members, groups, templates, matrix, documents, reading, reportScope] = await Promise.all([
    listMembers(db),
    rows<Group & { kind: string }>(db, 'SELECT * FROM groups ORDER BY name'),
    rows<Template>(db, 'SELECT * FROM templates ORDER BY name'),
    one<{ value: RiskMatrix }>(db, "SELECT value FROM settings WHERE id='matrix'"),
    library(db, id),
    requirements(db, id),
    readingReportScope(member),
  ]);
  return {
    now: new Date().toISOString(),
    member,
    // Keep bylines and historical report names even after access is revoked.
    // Assignment/owner controls and mutations independently require Docs access.
    // Colleagues are narrowed to names, groups and resolved access (see toWorkspaceMember).
    members: members.map(m => toWorkspaceMember(m.id === member.id ? member : m, member)),
    facilities: groups.filter((g) => g.kind === 'facility'),
    teams: groups.filter((g) => g.kind === 'team'),
    templates,
    matrix: matrix?.value || { configured: false, likelihood: [], severity: [], bands: [] },
    documents,
    requirements: reading,
    localMode: false,
    canReport: reportScope !== null,
  };
}
