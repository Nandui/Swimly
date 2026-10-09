import 'server-only';
import { subjectsFor } from '@/lib/policy/session';
import { canManage, type Member } from '@/modules/docs/shared/types';

/** Whose reading this person may report on.
 *  - 'all': organisation-wide Docs administration (or a superadmin).
 *  - a set of staff ids: a `docs.manage` role given for a site, a department
 *    or their own team, resolved by the platform policy engine.
 *  - null: no reading reports; authors still see totals on their own documents. */
export async function readingReportScope(m: Member): Promise<'all' | ReadonlySet<string> | null> {
  if (canManage(m)) return 'all';
  const filter = await subjectsFor('docs.manage');
  if (filter.kind === 'all') return 'all';
  return filter.userIds.size > 0 ? filter.userIds : null;
}
