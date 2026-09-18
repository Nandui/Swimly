import { redirect, notFound } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database, one } from '@/lib/docs/database';
import { workspace } from '@/lib/docs/queries';
import { canWrite, type Draft, type DocumentRecord } from '@/lib/docs/types';
import { DocumentEditor } from '@/components/docs/document-editor';
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await requireMember();
  if (!canWrite(m)) redirect('/docs/library');
  const id = (await params).id;
  const db = await database();
  const d = await one<Draft>(db, 'SELECT * FROM drafts WHERE document_id=$1', [id]);
  const doc = await one<DocumentRecord>(db, 'SELECT * FROM documents WHERE id=$1', [id]);
  if (!doc) notFound();
  if (!d || doc.archivedAt) redirect(`/docs/documents/${id}`);
  if (d.status === 'in_review') redirect(`/docs/documents/${id}?version=${d.submissionId}`);
  return <DocumentEditor workspace={await workspace(m.id)} initial={d} />;
}
