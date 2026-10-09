import { redirect } from 'next/navigation';
import { requireMember } from '@/modules/docs/lib/auth';
import { database, rows } from '@/modules/docs/lib/database';
import { workspace } from '@/modules/docs/lib/queries';
import { canManage, type AuditEvent } from '@/modules/docs/lib/types';
import { AdminView } from '@/modules/docs/components/admin';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Administration' };
export default async function AdminPage() {
  const m = await requireMember();
  if (!canManage(m)) redirect('/docs');
  const db = await database();
  return (
    <AdminView
      workspace={await workspace(m.id)}
      events={await rows<AuditEvent>(
        db,
        // Editing-lease renewals stay in the audit table; the activity view shows decisions and changes.
        "SELECT * FROM audit_events WHERE action NOT IN ('editing_session','editing_released') ORDER BY created_at DESC LIMIT 100",
      )}
      mail={[]}
    />
  );
}
