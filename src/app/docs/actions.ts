'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { database } from '@/lib/docs/database';
import { DocumentService, DomainError } from '@/lib/docs/domain';
import { requireActionMember } from '@/lib/docs/auth';
import type { DocumentContent, Member } from '@/lib/docs/types';
import { reportError } from '@/lib/docs/monitoring';
export type ActionResult<T = unknown> =
  { ok: true; data: T } | { ok: false; error: string; code: number };
async function run<T>(fn: () => Promise<T>, refresh = true): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (refresh) revalidatePath('/docs', 'layout');
    return { ok: true, data };
  } catch (e) {
    if (!(e instanceof DomainError) && !(e instanceof z.ZodError)) await reportError(e);
    return {
      ok: false,
      error:
        e instanceof DomainError
          ? e.message
          : e instanceof z.ZodError
            ? e.issues[0].message
            : 'Something went wrong. Your changes were not applied. Please try again.',
      code: e instanceof DomainError ? e.code : 400,
    };
  }
}
export async function createDocumentAction(content: DocumentContent) {
  return run(async () =>
    new DocumentService(await database()).create((await requireActionMember()).id, content),
  );
}
export async function startDraftAction(id: string, versionId?: string) {
  return run(async () =>
    new DocumentService(await database()).startDraft(
      (await requireActionMember()).id,
      id,
      versionId,
    ),
  );
}
export async function lockAction(id: string, session: string, release = false) {
  return run(
    async () =>
      new DocumentService(await database()).lock(
        (await requireActionMember()).id,
        id,
        session,
        release,
      ),
    false,
  );
}
export async function saveDraftAction(
  id: string,
  session: string,
  revision: number,
  content: DocumentContent,
) {
  return run(
    async () =>
      new DocumentService(await database()).save(
        (await requireActionMember()).id,
        id,
        session,
        revision,
        content,
      ),
    false,
  );
}
export async function submitAction(
  id: string,
  session: string,
  revision: number,
  approverId: string,
  summary: string,
) {
  return run(async () =>
    new DocumentService(await database()).submit(
      (await requireActionMember()).id,
      id,
      session,
      revision,
      approverId,
      summary,
    ),
  );
}
export async function reviewAction(
  id: string,
  submissionId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string,
) {
  return run(async () => {
    if (!['approved', 'changes_requested'].includes(decision))
      throw new DomainError('Invalid review decision.');
    return new DocumentService(await database()).review(
      (await requireActionMember()).id,
      id,
      submissionId,
      decision,
      feedback,
    );
  });
}
export async function acknowledgeAction(id: string, versionId: string) {
  return run(async () =>
    new DocumentService(await database()).acknowledge(
      (await requireActionMember()).id,
      id,
      versionId,
    ),
  );
}
export async function assignAction(
  id: string,
  people: string[],
  teams: string[],
  due: string | null,
) {
  return run(async () =>
    new DocumentService(await database()).assign(
      (await requireActionMember()).id,
      id,
      z.array(z.string()).parse(people),
      z.array(z.string()).parse(teams),
      due,
    ),
  );
}
export async function archiveAction(id: string, reason: string) {
  return run(async () =>
    new DocumentService(await database()).archive((await requireActionMember()).id, id, reason),
  );
}
export async function saveMemberAction(member: Pick<Member, 'id' | 'facilityIds' | 'teamIds'>) {
  return run(async () => {
    const validated = z
      .object({
        id: z.string(),
        facilityIds: z.array(z.string()).max(100),
        teamIds: z.array(z.string()).max(100),
      })
      .parse(member);
    return new DocumentService(await database()).saveMember(
      (await requireActionMember()).id,
      validated,
    );
  });
}
export async function saveGroupAction(kind: 'facility' | 'team', name: string, id?: string) {
  return run(async () =>
    new DocumentService(await database()).saveGroup(
      (await requireActionMember()).id,
      kind,
      name,
      id,
    ),
  );
}
export async function saveMatrixAction(matrix: unknown) {
  return run(async () =>
    new DocumentService(await database()).saveMatrix((await requireActionMember()).id, matrix),
  );
}
export async function saveTemplateAction(id: string, name: string, body: DocumentContent['body']) {
  return run(async () =>
    new DocumentService(await database()).saveTemplate(
      (await requireActionMember()).id,
      id,
      name,
      body,
    ),
  );
}
