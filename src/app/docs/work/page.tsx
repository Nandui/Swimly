import { requireMember } from '@/modules/docs/lib/auth';
import { database, rows } from '@/modules/docs/lib/database';
import { workspace } from '@/modules/docs/lib/queries';
import { canWrite, type Draft } from '@/modules/docs/lib/types';
import { WorkView } from '@/modules/docs/components/work';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My work' };
export default async function WorkPage() {
  const m = await requireMember();
  return (
    <WorkView
      workspace={await workspace(m.id)}
      drafts={
        canWrite(m)
          ? await rows<Draft>(
              await database(),
              'SELECT dr.* FROM drafts dr JOIN documents d ON d.id=dr.document_id WHERE d.archived_at IS NULL ORDER BY dr.updated_at DESC',
            )
          : []
      }
    />
  );
}
