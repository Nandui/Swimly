import { database, library, LibraryView, requireMember, workspace } from "@/modules/docs/features/library";
import type { Metadata } from 'next';

/** The tab title follows the H1, which the archive renames. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}): Promise<Metadata> {
  const p = await searchParams;
  return { title: p.archived === 'true' ? 'Document archive' : 'Document library' };
}
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const m = await requireMember();
  const p = await searchParams;
  const [w, documents] = await Promise.all([
    workspace(m.id),
    library(await database(), m.id, { query: p.q, archived: p.archived === 'true' }),
  ]);
  return <LibraryView workspace={w} documents={documents} />;
}
