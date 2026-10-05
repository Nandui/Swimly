import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { workspace } from '@/lib/docs/queries';
import { canWrite } from '@/lib/docs/types';
import { NewDocument } from '@/components/docs/new-document';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Create a document' };
export default async function NewDocumentPage() {
  const m = await requireMember();
  if (!canWrite(m)) redirect('/docs/library');
  return <NewDocument workspace={await workspace(m.id)} />;
}
