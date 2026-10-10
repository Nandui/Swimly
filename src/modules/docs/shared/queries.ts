import { database, rows, one, listMembers } from '@/modules/docs/shared/database';
import { actor, library, syncPlatformGroups } from '@/modules/docs/shared/domain';
import { readingReportScope } from '@/modules/docs/shared/report-scope';
import { toWorkspaceMember, type Workspace, type Group, type Template, type RiskMatrix } from '@/modules/docs/shared/types';
export async function workspace(id: string): Promise<Workspace> {
  const db = await database();
  const member = await actor(db, id);
  // Keep Docs' groups in step with the platform's sites and departments.
  await db.transaction(syncPlatformGroups);
  const [members, groups, templates, matrix, documents, reportScope] = await Promise.all([
    listMembers(db),
    rows<Group & { kind: string }>(db, 'SELECT * FROM groups ORDER BY name'),
    rows<Template>(db, 'SELECT * FROM templates ORDER BY name'),
    one<{ value: RiskMatrix }>(db, "SELECT value FROM settings WHERE id='matrix'"),
    library(db, id),
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
    // A person's own required reading lives in Turnfin Me (the staff app), never on Work.
    requirements: [],
    localMode: false,
    canReport: reportScope !== null,
  };
}
