'use server';
import { revalidatePath } from 'next/cache';
import { database } from '@/modules/docs/shared/database';
import { DocumentService, DomainError } from '@/modules/docs/shared/domain';
import { requireActionMember } from '@/modules/docs/shared/auth';
import { reportError } from '@/modules/docs/shared/monitoring';
import { hrProcedurePages } from '@/modules/docs/features/import/server/ready-made';

/** Adds the HR procedures as drafts owned by the Docs administrator who asks (audited). */
export async function addHrProceduresAction(): Promise<
  { ok: true; data: { added: number; alreadyThere: number } } | { ok: false; error: string }
> {
  try {
    const who = await requireActionMember();
    const data = await new DocumentService(await database()).addReadyMade(who.id, 'HR procedures', hrProcedurePages());
    revalidatePath('/docs', 'layout');
    return { ok: true, data };
  } catch (e) {
    if (!(e instanceof DomainError)) await reportError(e);
    return { ok: false, error: e instanceof DomainError ? e.message : 'Could not add the procedures. Try again.' };
  }
}
