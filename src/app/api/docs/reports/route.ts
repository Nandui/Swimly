import { NextRequest } from 'next/server';
import {
  database, DomainError, filterReading, library, listMembers, readingCsv, readingReportScope, requireActionMember, requirements,
} from "@/modules/docs/features/reports";
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
    return new Response(e instanceof DomainError ? e.message : 'Could not export the report. Try again.', {
      status: e instanceof DomainError ? e.code : 500,
    });
  }
}
