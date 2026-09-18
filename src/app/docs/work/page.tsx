import { requireMember } from '@/lib/docs/auth';
import { database, rows } from '@/lib/docs/database';
import { workspace } from '@/lib/docs/queries';
import { canWrite, type Draft } from '@/lib/docs/types';
import { WorkView } from '@/components/docs/work';
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
