import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database, rows } from '@/lib/docs/database';
import { workspace } from '@/lib/docs/queries';
import { canManage, type AuditEvent } from '@/lib/docs/types';
import { AdminView } from '@/components/docs/admin';
export default async function AdminPage() {
  const m = await requireMember();
  if (!canManage(m)) redirect('/docs');
  const db = await database();
  return (
    <AdminView
      workspace={await workspace(m.id)}
      events={await rows<AuditEvent>(
        db,
        'SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100',
      )}
      mail={[]}
    />
  );
}
