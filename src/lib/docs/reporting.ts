import type { Requirement, LibraryDocument, Member } from './types';
export type ReportFilters = {
  document?: string;
  version?: string;
  team?: string;
  facility?: string;
  status?: string;
  history?: boolean;
};
export function filterReading(
  items: Requirement[],
  documents: LibraryDocument[],
  members: Member[],
  filters: ReportFilters,
) {
  return items.filter((r) => {
    const m = members.find((m) => m.id === r.memberId);
    const d = documents.find((d) => d.id === r.documentId);
    return (
      (filters.history ||
        (!d?.archivedAt && d?.currentVersionId === r.versionId && r.status !== 'cancelled')) &&
      (!filters.document || r.documentId === filters.document) &&
      (!filters.version || r.versionId === filters.version) &&
      (!filters.team || m?.teamIds.includes(filters.team)) &&
      (!filters.facility || !r.facilityIds.length || r.facilityIds.includes(filters.facility)) &&
      (!filters.status || r.status === filters.status)
    );
  });
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function readingCsv(items: Requirement[], members: Member[]) {
  const header = [
    'Document',
    'Reference',
    'Version',
    'Staff member',
    'Email',
    'Status',
    'Due date',
    'Acknowledged at',
  ];
  const data = items.map((r) => {
    const m = members.find((m) => m.id === r.memberId);
    return [
      r.title,
      r.reference,
      r.version,
      m?.name,
      m?.email,
      r.status,
      r.dueDate,
      r.acknowledgedAt,
    ];
  });
  return '\uFEFF' + [header, ...data].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
