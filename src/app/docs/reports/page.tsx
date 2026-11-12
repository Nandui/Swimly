import { redirect } from 'next/navigation';
import { database, library, readingReportScope, ReportsView, requireMember, requirements, workspace } from "@/modules/docs/features/reports";
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Reading reports' };
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
