import { requireMember } from '@/lib/docs/auth';
import { database } from '@/lib/docs/database';
import { library } from '@/lib/docs/domain';
import { workspace } from '@/lib/docs/queries';
import { LibraryView } from '@/components/docs/library';
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
