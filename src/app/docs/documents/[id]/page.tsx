import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database } from '@/lib/docs/database';
import { workspace } from '@/lib/docs/queries';
import { documentView, DomainError } from '@/lib/docs/domain';
import { DocumentBody, RiskAssessmentView, tableOfContents } from '@/components/docs/document-body';
import { Reader } from '@/components/docs/reader';
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const m = await requireMember();
  const id = (await params).id;
  let view;
  try {
    view = await documentView(await database(), m.id, id, (await searchParams).version);
  } catch (e) {
    if (e instanceof DomainError && e.code === 404) notFound();
    throw e;
  }
  const w = await workspace(m.id);
  const content = view.selected?.content || view.draft!.content;
  return (
    <Reader workspace={w} {...view} content={content} toc={tableOfContents(content.body)}>
      <DocumentBody body={content.body} />
      <RiskAssessmentView content={content} members={w.members} />
    </Reader>
  );
}
