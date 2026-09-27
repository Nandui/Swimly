import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database } from '@/lib/docs/database';
import { library, requirements } from '@/lib/docs/domain';
import { workspace } from '@/lib/docs/queries';
import { canManage } from '@/lib/docs/types';
import { ReportsView } from '@/components/docs/reports';
export default async function ReportsPage() {
  const m = await requireMember();
  if (!canManage(m)) redirect('/docs');
  const db = await database();
  const [w, items, archived] = await Promise.all([
    workspace(m.id),
    requirements(db, m.id, true),
    library(db, m.id, { archived: true }),
  ]);
  return <ReportsView workspace={w} items={items} documents={[...w.documents, ...archived]} />;
}
