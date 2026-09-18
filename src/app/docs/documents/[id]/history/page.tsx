import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database, rows } from '@/lib/docs/database';
import { documentView, DomainError } from '@/lib/docs/domain';
import { workspace } from '@/lib/docs/queries';
import { canWrite, type AuditEvent } from '@/lib/docs/types';
import { HistoryView } from '@/components/docs/history';
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await requireMember();
  const id = (await params).id;
  const db = await database();
  let view;
  try {
    view = await documentView(db, m.id, id);
  } catch (e) {
    if (e instanceof DomainError && e.code === 404) notFound();
    throw e;
  }
  return (
    <HistoryView
      workspace={await workspace(m.id)}
      id={id}
      snapshots={view.snapshots}
      events={
        canWrite(m)
          ? await rows<AuditEvent>(
              db,
              'SELECT * FROM audit_events WHERE document_id=$1 ORDER BY created_at DESC',
              [id],
            )
          : []
      }
      archived={!!view.document.archivedAt}
    />
  );
}
