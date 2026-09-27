import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database } from '@/lib/docs/database';
import { library, requirements } from '@/lib/docs/domain';
import { workspace } from '@/lib/docs/queries';
import { readingReportScope } from '@/lib/docs/report-scope';
import { ReportsView } from '@/components/docs/reports';
export default async function ReportsPage() {
  const m = await requireMember();
  // Organisation-wide Docs administrators see everyone; a Docs manager for a
  // site, department or their own team sees exactly those people.
  const scope = await readingReportScope(m);
  if (!scope) redirect('/docs');
  const db = await database();
  const [w, items, archived] = await Promise.all([
    workspace(m.id),
    requirements(db, m.id, scope),
    library(db, m.id, { archived: true }),
  ]);
  return <ReportsView workspace={w} items={items} documents={[...w.documents, ...archived]} />;
}
