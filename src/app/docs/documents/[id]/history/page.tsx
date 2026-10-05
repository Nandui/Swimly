import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database, rows } from '@/lib/docs/database';
import { documentView, DomainError } from '@/lib/docs/domain';
import { workspace } from '@/lib/docs/queries';
import { canWrite, type AuditEvent } from '@/lib/docs/types';
import { HistoryView } from '@/components/docs/history';
import type { Metadata } from 'next';
import { cache } from 'react';

/** One query per request, shared by the page and its tab title. */
const load = cache(async (member: string, id: string) => documentView(await database(), member, id));

/** Named from what the reader shows: the current version's title, or the draft's for an author. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await requireMember();
  try {
    const view = await load(m.id, (await params).id);
    return { title: `${(view.selected?.content || view.draft!.content).title} history` };
  } catch (e) {
    if (e instanceof DomainError && e.code === 404) return { title: 'Page not found' };
    throw e;
  }
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await requireMember();
  const id = (await params).id;
  const db = await database();
  let view;
  try {
    view = await load(m.id, id);
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
