import { redirect } from 'next/navigation';
import { canWrite, NewDocument, requireMember, workspace } from "@/modules/docs/features/editor";
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Create a document' };
export default async function NewDocumentPage() {
  const m = await requireMember();
  if (!canWrite(m)) redirect('/docs/library');
  return <NewDocument workspace={await workspace(m.id)} />;
}
