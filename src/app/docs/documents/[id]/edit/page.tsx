import { redirect, notFound } from 'next/navigation';
import { canWrite, database, DocumentEditor, type DocumentRecord, type Draft, one, requireMember, workspace } from "@/modules/docs/features/editor";
import type { Metadata } from 'next';
import { cache } from 'react';

/** One pair of queries per request, shared by the page and its tab title. */
const load = cache(async (id: string) => {
  const db = await database();
  const [d, doc] = await Promise.all([
    one<Draft>(db, 'SELECT * FROM drafts WHERE document_id=$1', [id]),
    one<DocumentRecord>(db, 'SELECT * FROM documents WHERE id=$1', [id]),
  ]);
  return { d, doc };
});

/** Only authors reach the editor, so the draft's title is theirs to see. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await requireMember();
  if (!canWrite(m)) return { title: 'Edit document' };
  const { d } = await load((await params).id);
  return { title: d ? `Edit ${d.content.title}` : 'Edit document' };
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const m = await requireMember();
  if (!canWrite(m)) redirect('/docs/library');
  const id = (await params).id;
  const { d, doc } = await load(id);
  if (!doc) notFound();
  if (!d || doc.archivedAt) redirect(`/docs/documents/${id}`);
  if (d.status === 'in_review') redirect(`/docs/documents/${id}?version=${d.submissionId}`);
  return <DocumentEditor workspace={await workspace(m.id)} initial={d} />;
}
