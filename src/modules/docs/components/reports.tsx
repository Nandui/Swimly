'use client';
import { Label } from '@/components/shadcn/label';
import { NativeSelectOption } from '@/components/shadcn/native-select';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/shadcn/table';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/shadcn/button';
import { BookOpen, ChartNoAxesColumn, ChevronRight, CircleCheck, Download, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import {
  formatDate,
  overdue,
  DOC_STATUS_META,
  type DocStatus,
  type Workspace,
  type Requirement,
  type LibraryDocument,
} from '@/modules/docs/lib/types';
import { Tag } from '@/components/ui-kit/tag';
import { filterReading, type ReportFilters } from '@/modules/docs/lib/reporting';
import { FilterSelect } from './ui';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';

/** Where one person's required reading stands. */
const readingStatus = (r: Pick<Requirement, 'status' | 'dueDate'>): DocStatus =>
  r.status === 'completed'
    ? 'acknowledged'
    : r.status === 'cancelled'
      ? 'cancelled'
      : overdue(r.dueDate)
        ? 'overdue'
        : 'toRead';
export function ReportsView({
  workspace: w,
  items,
  documents,
}: {
  workspace: Workspace;
  items: Requirement[];
  documents: LibraryDocument[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const historyId = useId();
  const filters: ReportFilters = {
    document: params.get('document') || '',
    version: params.get('version') || '',
    team: params.get('team') || '',
    facility: params.get('facility') || '',
    status: params.get('status') || '',
    history: params.get('history') === 'true',
  };
  function setFilters(next: ReportFilters) {
    const query = new URLSearchParams(
      Object.entries(next)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, String(value)]),
    );
    router.replace(`/docs/reports${query.size ? `?${query}` : ''}`, { scroll: false });
  }
  const visible = filterReading(items, documents, w.members, filters);
  const scope = filterReading(items, documents, w.members, { ...filters, status: '' });
  const completed = scope.filter((r) => r.status === 'completed').length;
  const waiting = scope.filter((r) => r.status === 'outstanding').length;
  const active = completed + waiting;
  const hasFilters = Object.values(filters).some(Boolean);
  const filterCount = Object.values(filters).filter(Boolean).length;
  const [phoneOpen, setPhoneOpen] = useState(false);
  const set = (key: keyof ReportFilters, value: string | boolean) =>
    setFilters({ ...filters, [key]: value, ...(key === 'document' ? { version: '' } : {}) });
  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => [k, String(v)]),
  );
  const versions = Array.from(
    new Map(
      items
        .filter((r) => !filters.document || r.documentId === filters.document)
        .map((r) => [
          r.versionId,
          { id: r.versionId, label: `${r.reference} · Version ${r.version}` },
        ]),
    ).values(),
  );
  /** This page's URL with the status filter changed and every other filter kept. */
  const statusHref = (status: string) => {
    const next = new URLSearchParams(query);
    if (status) next.set('status', status);
    else next.delete('status');
    return `/docs/reports${next.size ? `?${next}` : ''}`;
  };
  const late = scope.filter((r) => r.status === 'outstanding' && overdue(r.dueDate)).length;
  const tiles = [
    { status: '', icon: BookOpen, value: scope.length, label: 'Reading assignments', caption: filters.history ? 'Including earlier versions' : 'Current versions' },
    { status: 'completed', icon: CircleCheck, value: completed, label: 'Acknowledged', caption: 'Read and confirmed' },
    { status: 'outstanding', icon: TriangleAlert, value: waiting, label: 'Still to read', caption: late ? <Tag meta={DOC_STATUS_META.overdue} label={`${late} overdue`} /> : 'None overdue' },
  ];
  const nameOf = (r: Requirement) => w.members.find((m) => m.id === r.memberId)?.name || 'Former staff';
  /** Where a record stands in words, for the phone caption that replaces its last columns. */
  const when = (r: Requirement) =>
    r.acknowledgedAt ? `read ${formatDate(r.acknowledgedAt)}` : r.dueDate ? `due ${formatDate(r.dueDate)}` : 'due date not set';
  return (
    <>
      <PageHeader
        title="Reading reports"
        description="See who has read each version, and where your team needs a reminder"
        actions={
          <Button asChild variant="outline">
            <a href={`/api/docs/reports?${query}`}>
              <Download aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        }
      />
      <ul className="pc-stats" aria-label="Reading at a glance">
        {tiles.map(({ status, icon: Icon, value, label, caption }) => (
          <li key={label} className="flex min-w-0">
            <Link
              href={statusHref(status)}
              scroll={false}
              className="pc-stat w-full"
              aria-current={status && filters.status === status ? 'true' : undefined}
            >
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span>
                <span className="pc-stat-figure block">{value}</span>
                <span className="block font-semibold">{label}</span>
              </span>
              {typeof caption === 'string' ? <span className="text-xs text-ui-muted-foreground">{caption}</span> : caption}
            </Link>
          </li>
        ))}
        <li className="flex min-w-0">
          <div className="pc-stat w-full">
            <span className="pc-tile-icon"><ChartNoAxesColumn aria-hidden="true" /></span>
            <span>
              <span className="pc-stat-figure block">{active ? `${Math.round((completed / active) * 100)}%` : '—'}</span>
              <span className="block font-semibold">Reading complete</span>
            </span>
            <span className="text-xs text-ui-muted-foreground">Across all current assignments</span>
          </div>
        </li>
      </ul>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <section className="pc-panel" aria-labelledby="report-filter-heading">
          <div className="pc-panel-head">
            <h2 id="report-filter-heading">Filter records</h2>
            {hasFilters && (
              <Button asChild variant="link">
                <Link href="/docs/reports" scroll={false}>Reset</Link>
              </Button>
            )}
          </div>
          {/* Phones: the filters sit behind one button so the records start sooner. */}
          <Button
            type="button"
            variant="outline"
            className="self-start sm:hidden"
            aria-expanded={phoneOpen}
            aria-controls="report-filters"
            onClick={() => setPhoneOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters{filterCount ? ` (${filterCount})` : ''}
          </Button>
          <div id="report-filters" className={cn('contents', !phoneOpen && 'max-sm:hidden')}>
          <div className="flex flex-wrap items-end gap-3 lg:flex-col lg:items-stretch">
            <FilterSelect label="Document" className="grow basis-48 lg:basis-auto" value={filters.document || ''} onChange={(value) => set('document', value)}>
              <NativeSelectOption value="">All documents</NativeSelectOption>
              {documents.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.content.title}
                </NativeSelectOption>
              ))}
            </FilterSelect>
            <FilterSelect label="Version" className="grow basis-48 lg:basis-auto" value={filters.version || ''} onChange={(value) => set('version', value)}>
              <NativeSelectOption value="">All selected versions</NativeSelectOption>
              {versions.map((v) => (
                <NativeSelectOption key={v.id} value={v.id}>
                  {v.label}
                </NativeSelectOption>
              ))}
            </FilterSelect>
            <FilterSelect label="Team" className="grow basis-48 lg:basis-auto" value={filters.team || ''} onChange={(value) => set('team', value)}>
              <NativeSelectOption value="">All teams</NativeSelectOption>
              {w.teams.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </FilterSelect>
            <FilterSelect label="Facility" className="grow basis-48 lg:basis-auto" value={filters.facility || ''} onChange={(value) => set('facility', value)}>
              <NativeSelectOption value="">All facilities</NativeSelectOption>
              {w.facilities.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  {f.name}
                </NativeSelectOption>
              ))}
            </FilterSelect>
            <FilterSelect label="Status" className="grow basis-48 lg:basis-auto" value={filters.status || ''} onChange={(value) => set('status', value)}>
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              <NativeSelectOption value="outstanding">To read</NativeSelectOption>
              <NativeSelectOption value="completed">Acknowledged</NativeSelectOption>
              <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
            </FilterSelect>
          </div>
          <Label htmlFor={historyId} className="flex min-h-11 flex-row items-start gap-3 py-3 font-normal">
            <Checkbox
              id={historyId}
              checked={!!filters.history}
              onCheckedChange={(checked) => set('history', checked === true)}
            />
            Include earlier versions, archived documents and cancelled reading
          </Label>
          </div>
        </section>
        <section className="pc-panel" aria-labelledby="report-records-heading">
          <div>
            <h2 id="report-records-heading">
              {filters.status === 'outstanding'
                ? 'Outstanding reading'
                : filters.status === 'completed'
                  ? 'Acknowledged reading'
                  : 'Reading records'}
            </h2>
            <p role="status" className="text-xs text-ui-muted-foreground">
              {visible.length} {visible.length === 1 ? 'record' : 'records'} ·{' '}
              {filters.history ? 'Includes earlier versions' : 'Current published versions'}
            </p>
          </div>
          {visible.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead className="max-md:hidden">Document</TableHead>
                  <TableHead className="max-md:hidden">Version</TableHead>
                  <TableHead className="max-md:hidden">Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="max-md:hidden">Acknowledged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-normal">
                      <span className="block font-semibold">{nameOf(r)}</span>
                      {/* Phones: the document, version and date move under the name. */}
                      <Link className="flex min-h-11 flex-col justify-center underline-offset-2 hover:underline md:hidden" href={`/docs/documents/${r.documentId}?version=${r.versionId}`}>
                        <span className="font-semibold">{r.title}</span>
                        <span className="text-xs text-ui-muted-foreground">{`${r.reference} · version ${r.version} · ${when(r)}`}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-md:hidden whitespace-normal">
                      <Link className="flex min-h-11 flex-col justify-center underline-offset-2 hover:underline" href={`/docs/documents/${r.documentId}?version=${r.versionId}`}>
                        <span className="font-semibold">{r.title}</span>
                        <span className="text-xs text-ui-muted-foreground">{r.reference}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-md:hidden tabular-nums">v{r.version}</TableCell>
                    <TableCell className="max-md:hidden">{formatDate(r.dueDate)}</TableCell>
                    <TableCell>
                      <Tag meta={DOC_STATUS_META[readingStatus(r)]} />
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      {r.acknowledgedAt ? formatDate(r.acknowledgedAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              as="h3"
              icon="book"
              title="No reading records match"
              hint="Change the filters, or assign required reading from a document"
              action={
                <Button asChild variant="outline">
                  <Link href={hasFilters ? '/docs/reports' : '/docs/library'}>
                    {hasFilters ? 'Clear filters' : 'Open the library'}
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
