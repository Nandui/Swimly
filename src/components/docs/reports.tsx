'use client';
import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/shadcn/table';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/shadcn/button';
import { Progress } from '@/components/shadcn/progress';
import { Download, CheckCircle2, Clock3, Users } from 'lucide-react';
import Link from 'next/link';
import {
  formatDate,
  overdue,
  type Workspace,
  type Requirement,
  type LibraryDocument,
} from '@/lib/docs/types';
import { filterReading, type ReportFilters } from '@/lib/docs/reporting';
import { PageHeading, Badge, Avatar, EmptyState } from './ui';
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
  const [showFilters, setShowFilters] = useState(false);
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
  return (
    <div className="report-workspace">
      <PageHeading
        eyebrow="KEEP EVERYONE UP TO DATE"
        title="Reading reports"
        description="See who has read each version, and where your team needs a reminder."
        action={
          <Button asChild variant="outline">
            <a className="button secondary" href={`/api/docs/reports?${query}`}>
              <Download size={17} />
              Export CSV
            </a>
          </Button>
        }
      />
      <div className="report-stats">
        <Button
          variant="outline"
          className="panel report-stat-button h-auto whitespace-normal"
          onClick={() => set('status', '')}
          aria-pressed={!filters.status}
        >
          <Users size={21} />
          <strong>{scope.length}</strong>
          <span>Reading assignments</span>
        </Button>
        <Button
          variant="outline"
          className="panel report-stat-button h-auto whitespace-normal"
          onClick={() => set('status', 'completed')}
          aria-pressed={filters.status === 'completed'}
        >
          <CheckCircle2 size={21} />
          <strong>{completed}</strong>
          <span>Acknowledged</span>
        </Button>
        <Button
          variant="outline"
          className="panel report-stat-button h-auto whitespace-normal"
          onClick={() => set('status', 'outstanding')}
          aria-pressed={filters.status === 'outstanding'}
        >
          <Clock3 size={21} />
          <strong>{waiting}</strong>
          <span>Still to read</span>
        </Button>
        <Card asChild>
          <div className="panel">
            <Progress
              className="completion-track"
              value={active ? (completed / active) * 100 : 0}
              aria-label="Reading complete"
            />
            <strong>{active ? `${Math.round((completed / active) * 100)}%` : '—'}</strong>
            <span>Reading complete</span>
          </div>
        </Card>
      </div>
      <section className="reports-workbench">
        <aside className="report-filter-panel" data-expanded={showFilters}>
          <div className="report-filter-heading">
            <h2>Filter records</h2>
            {hasFilters && (
              <Button variant="ghost" onClick={() => setFilters({})}>
                Reset
              </Button>
            )}
          </div>
          <div className="report-mobile-filter-toggle">
            <Button
              variant="outline"
              aria-expanded={showFilters}
              aria-controls="report-filter-fields"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide filters' : 'Show filters'}
              {hasFilters ? ' · Active' : ''}
            </Button>
          </div>
          <div id="report-filter-fields">
            <div className="report-filters">
              <Label>
                Document
                <NativeSelect
                  value={filters.document || ''}
                  onChange={(e) => set('document', e.target.value)}
                >
                  <NativeSelectOption value="">All documents</NativeSelectOption>
                  {documents.map((d) => (
                    <NativeSelectOption key={d.id} value={d.id}>
                      {d.content.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
              <Label>
                Version
                <NativeSelect
                  value={filters.version || ''}
                  onChange={(e) => set('version', e.target.value)}
                >
                  <NativeSelectOption value="">All selected versions</NativeSelectOption>
                  {versions.map((v) => (
                    <NativeSelectOption key={v.id} value={v.id}>
                      {v.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
              <Label>
                Team
                <NativeSelect
                  value={filters.team || ''}
                  onChange={(e) => set('team', e.target.value)}
                >
                  <NativeSelectOption value="">All teams</NativeSelectOption>
                  {w.teams.map((t) => (
                    <NativeSelectOption key={t.id} value={t.id}>
                      {t.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
              <Label>
                Facility
                <NativeSelect
                  value={filters.facility || ''}
                  onChange={(e) => set('facility', e.target.value)}
                >
                  <NativeSelectOption value="">All facilities</NativeSelectOption>
                  {w.facilities.map((f) => (
                    <NativeSelectOption key={f.id} value={f.id}>
                      {f.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
              <Label>
                Status
                <NativeSelect
                  value={filters.status || ''}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  <NativeSelectOption value="outstanding">To read</NativeSelectOption>
                  <NativeSelectOption value="completed">Acknowledged</NativeSelectOption>
                  <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
                </NativeSelect>
              </Label>
            </div>
            <Label className="checkbox-label history-toggle">
              <Checkbox
                checked={!!filters.history}
                onCheckedChange={(checked) => set('history', checked === true)}
              />
              Include previous versions, archived documents, and cancelled assignments
            </Label>
          </div>
        </aside>
        <Card asChild>
          <div className="report-records panel">
            <div className="report-records-heading">
              <div>
                <h2>
                  {filters.status === 'outstanding'
                    ? 'Outstanding reading'
                    : filters.status === 'completed'
                      ? 'Acknowledged reading'
                      : 'Reading records'}
                </h2>
                <p role="status">
                  {visible.length} {visible.length === 1 ? 'record' : 'records'} ·{' '}
                  {filters.history
                    ? 'Includes historical assignments'
                    : 'Current published versions'}
                </p>
              </div>
            </div>
            {visible.length ? (
              <div className="table-scroll">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff member</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Acknowledged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="staff-cell">
                            <Avatar
                              small
                              member={
                                w.members.find((m) => m.id === r.memberId) || {
                                  name: 'Former staff',
                                }
                              }
                            />
                            {w.members.find((m) => m.id === r.memberId)?.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link href={`/docs/documents/${r.documentId}?version=${r.versionId}`}>
                            {r.title}
                          </Link>
                          <small>{r.reference}</small>
                        </TableCell>
                        <TableCell>v{r.version}</TableCell>
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              r.status === 'completed'
                                ? 'green'
                                : r.status === 'cancelled'
                                  ? 'neutral'
                                  : overdue(r.dueDate)
                                    ? 'red'
                                    : 'amber'
                            }
                          >
                            {r.status === 'completed'
                              ? 'Acknowledged'
                              : r.status === 'cancelled'
                                ? 'Cancelled'
                                : overdue(r.dueDate)
                                  ? 'Overdue'
                                  : 'To read'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.acknowledgedAt ? formatDate(r.acknowledgedAt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title="No matching reading records"
                description="Change your filters or assign required reading from a document."
                href={hasFilters ? '/docs/reports' : '/docs/library'}
                label={hasFilters ? 'Clear filters' : 'Open the library'}
              />
            )}
            {visible.length > 0 && (
              <ul className="report-mobile-records">
                {visible.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {w.members.find((member) => member.id === r.memberId)?.name ||
                          'Former staff'}
                      </strong>
                      <Badge
                        tone={
                          r.status === 'completed'
                            ? 'green'
                            : r.status === 'cancelled'
                              ? 'neutral'
                              : overdue(r.dueDate)
                                ? 'red'
                                : 'amber'
                        }
                      >
                        {r.status === 'completed'
                          ? 'Acknowledged'
                          : r.status === 'cancelled'
                            ? 'Cancelled'
                            : overdue(r.dueDate)
                              ? 'Overdue'
                              : 'To read'}
                      </Badge>
                    </div>
                    <Link href={`/docs/documents/${r.documentId}?version=${r.versionId}`}>
                      {r.title}
                    </Link>
                    <p>
                      {r.reference} · Version {r.version}
                    </p>
                    <span>
                      {r.acknowledgedAt
                        ? `Read ${formatDate(r.acknowledgedAt)}`
                        : r.dueDate
                          ? `Due ${formatDate(r.dueDate)}`
                          : 'No deadline'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
