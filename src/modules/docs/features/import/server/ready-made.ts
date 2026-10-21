import { HR_PROCEDURES } from '@/modules/docs/features/import/content/hr-procedures';
import { parseNotionPage } from '@/modules/docs/features/import/server/notion-import';
import type { ReadyMadePage } from '@/modules/docs/shared/domain';
import { rows, type Sql } from '@/modules/docs/shared/database';

/** The HR procedures as Docs pages, read from their Markdown. */
export function hrProcedurePages(today?: string): ReadyMadePage[] {
  return HR_PROCEDURES.map((text) => {
    const { reference, title, type, summary, reviewDate, body } = parseNotionPage(text, '', today);
    return { reference, title, type, summary, reviewDate, body };
  });
}

export type ReadyMadeItem = { reference: string; title: string; added: boolean };

/** Each HR procedure and whether a document with its reference is already in Docs. */
export async function hrProcedureStatus(db: Sql): Promise<ReadyMadeItem[]> {
  const present = new Set(
    (
      await rows<{ reference: string }>(
        db,
        "SELECT lower(content->>'reference') AS reference FROM drafts UNION SELECT lower(content->>'reference') FROM snapshots",
      )
    ).map((r) => r.reference),
  );
  return hrProcedurePages().map((p) => ({ reference: p.reference, title: p.title, added: present.has(p.reference.toLowerCase()) }));
}
