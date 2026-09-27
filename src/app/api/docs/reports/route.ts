import { NextRequest } from 'next/server';
import { requireActionMember } from '@/lib/docs/auth';
import { database, listMembers } from '@/lib/docs/database';
import { library, requirements, DomainError } from '@/lib/docs/domain';
import { filterReading, readingCsv } from '@/lib/docs/reporting';
import { readingReportScope } from '@/lib/docs/report-scope';
export async function GET(request: NextRequest) {
  try {
    const m = await requireActionMember();
    const scope = await readingReportScope(m);
    if (!scope) throw new DomainError('Reporting access requires Docs administration.', 403);
    const db = await database();
    const [items, documents, archived, members] = await Promise.all([
      requirements(db, m.id, scope),
      library(db, m.id),
      library(db, m.id, { archived: true }),
      listMembers(db),
    ]);
    const p = request.nextUrl.searchParams;
    const visible = filterReading(items, [...documents, ...archived], members, {
      document: p.get('document') || '',
      version: p.get('version') || '',
      team: p.get('team') || '',
      facility: p.get('facility') || '',
      status: p.get('status') || '',
      history: p.get('history') === 'true',
    });
    return new Response(readingCsv(visible, members), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="turnfin-reading-report.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return new Response(e instanceof DomainError ? e.message : 'Unable to export report.', {
      status: e instanceof DomainError ? e.code : 500,
    });
  }
}
