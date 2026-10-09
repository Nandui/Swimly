import { redirect } from 'next/navigation';
import { requireMember } from '@/modules/docs/lib/auth';
import { workspace } from '@/modules/docs/lib/queries';
import { canWrite } from '@/modules/docs/lib/types';
import { NewDocument } from '@/modules/docs/components/new-document';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Create a document' };
export default async function NewDocumentPage() {
  const m = await requireMember();
  if (!canWrite(m)) redirect('/docs/library');
  return <NewDocument workspace={await workspace(m.id)} />;
}
