import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/docs/auth';
import { database } from '@/lib/docs/database';
import { workspace } from '@/lib/docs/queries';
import { documentView, DomainError } from '@/lib/docs/domain';
import { DocumentBody, RiskAssessmentView, tableOfContents } from '@/components/docs/document-body';
import { Reader } from '@/components/docs/reader';
import type { Metadata } from 'next';
import { cache } from 'react';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> };

/** One query per request, shared by the page and its tab title. */
const load = cache(async (member: string, id: string, version?: string) =>
  documentView(await database(), member, id, version),
);

/** The title is what the H1 shows: the selected version's title, or the draft's for an
 *  author, never the raw row, so readers never see an unpublished title. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const m = await requireMember();
  try {
    const view = await load(m.id, (await params).id, (await searchParams).version);
    return { title: (view.selected?.content || view.draft!.content).title };
  } catch (e) {
    if (e instanceof DomainError && e.code === 404) return { title: 'Page not found' };
    throw e;
  }
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const m = await requireMember();
  const id = (await params).id;
  let view;
  try {
    view = await load(m.id, id, (await searchParams).version);
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
