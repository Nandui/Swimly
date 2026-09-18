'use client';

import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Input } from '@/components/shadcn/input';
import { Card } from '@/components/shadcn/card';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Archive, ArrowRight, Plus, Search, X } from 'lucide-react';
import {
  canWrite,
  documentTypes,
  type DocumentType,
  type Workspace,
  type LibraryDocument,
} from '@/lib/docs/types';
import { Button } from '@/components/shadcn/button';
import { DocumentList } from './document-list';
import { PageHeading, EmptyState } from './ui';

const typeLabels: Record<DocumentType, string> = {
  SOP: 'Procedures',
  NOP: 'Operations',
  EAP: 'Emergency plans',
  'Risk assessment': 'Risk assessments',
  Policy: 'Policies',
  Custom: 'Other',
};

export function LibraryView({
  workspace: w,
  documents,
}: {
  workspace: Workspace;
  documents: LibraryDocument[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const type = params.get('type') || '';
  const facility = params.get('facility') || '';
  const team = params.get('team') || '';
  const query = params.get('q') || '';
  const archived = params.get('archived') === 'true';
  const sort = params.get('sort') === 'title' ? 'title' : 'recent';
  const scoped = documents.filter(
    (d) =>
      (!facility || !d.content.facilityIds.length || d.content.facilityIds.includes(facility)) &&
      (!team || !d.content.teamIds.length || d.content.teamIds.includes(team)),
  );
  const visible = scoped
    .filter((d) => !type || d.content.type === type)
    .sort((a, b) =>
      sort === 'title'
        ? a.content.title.localeCompare(b.content.title)
        : (b.publishedAt || '').localeCompare(a.publishedAt || ''),
    );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/docs/library${next.size ? `?${next}` : ''}`, { scroll: false }));
  }
  const hasFilters = !!(query || facility || team || type);
  const clearUrl = archived ? '/docs/library?archived=true' : '/docs/library';

  return (
    <div className="knowledge-library">
      <PageHeading
        eyebrow="A shared source of truth"
        title={
          archived
            ? 'Document archive'
            : type === 'EAP'
              ? 'Emergency plans'
              : 'The document library'
        }
        description={
          archived
            ? 'Previous guidance, preserved with its complete history.'
            : type === 'EAP'
              ? 'Find the approved response for your facility, without the search.'
              : 'Everything your team knows. Right where you need it.'
        }
        action={
          canWrite(w.member) ? (
            <div className="library-create">
              <Button asChild>
                <Link href="/docs/documents/new">
                  <Plus size={17} aria-hidden="true" />
                  New document
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="library-type-filters" role="group" aria-label="Filter by document type">
        <Button
          variant="ghost"
          aria-pressed={!type}
          onClick={() => filter('type', '')}
          disabled={pending}
        >
          All documents <span>{scoped.length}</span>
        </Button>
        {documentTypes.map((item) => (
          <Button
            key={item}
            variant="ghost"
            aria-pressed={type === item}
            onClick={() => filter('type', item)}
            disabled={pending}
          >
            {typeLabels[item]}
            <span>{scoped.filter((d) => d.content.type === item).length}</span>
          </Button>
        ))}
      </div>
      <Label className="library-mobile-type">
        <span className="sr-only">Document type</span>
        <NativeSelect
          value={type}
          onChange={(event) => filter('type', event.target.value)}
          disabled={pending}
        >
          <NativeSelectOption value="">All documents ({scoped.length})</NativeSelectOption>
          {documentTypes.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {typeLabels[item]} (
              {scoped.filter((document) => document.content.type === item).length})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <div className="library-filter-bar">
        <form
          action="/docs/library"
          className="library-search"
          role="search"
          aria-label="Search document library"
        >
          <Search size={18} aria-hidden="true" />
          <Input
            key={query}
            type="search"
            name="q"
            aria-label="Search document library"
            placeholder="Search title, reference or content…"
            defaultValue={query}
          />
          {type && <input type="hidden" name="type" value={type} />}
          {facility && <input type="hidden" name="facility" value={facility} />}
          {team && <input type="hidden" name="team" value={team} />}
          {archived && <input type="hidden" name="archived" value="true" />}
          {sort === 'title' && <input type="hidden" name="sort" value={sort} />}
          <Button type="submit" variant="ghost" size="icon" aria-label="Submit document search">
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>
        <Label>
          <span className="sr-only">Facility</span>
          <NativeSelect
            value={facility}
            onChange={(e) => filter('facility', e.target.value)}
            disabled={pending}
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
          <span className="sr-only">Team</span>
          <NativeSelect
            value={team}
            onChange={(e) => filter('team', e.target.value)}
            disabled={pending}
          >
            <NativeSelectOption value="">All teams</NativeSelectOption>
            {w.teams.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Button
          variant="ghost"
          aria-pressed={archived}
          onClick={() => filter('archived', archived ? '' : 'true')}
          disabled={pending}
        >
          <Archive size={17} aria-hidden="true" />
          Archive
        </Button>
      </div>
      <div className="library-result-bar">
        <div>
          <span role="status">
            {pending
              ? 'Updating documents…'
              : `${visible.length} ${visible.length === 1 ? 'document' : 'documents'}${query ? ` matching “${query}”` : ''}`}
          </span>
          {hasFilters && (
            <Link href={clearUrl} className="clear-filters">
              <X size={14} aria-hidden="true" />
              Clear filters
            </Link>
          )}
        </div>
        <Label>
          <span className="sr-only">Sort documents</span>
          <NativeSelect
            value={sort}
            onChange={(e) => filter('sort', e.target.value)}
            disabled={pending}
          >
            <NativeSelectOption value="recent">Recently published</NativeSelectOption>
            <NativeSelectOption value="title">Title, A–Z</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>
      <div aria-busy={pending} className="library-results">
        {visible.length ? (
          <DocumentList documents={visible} facilities={w.facilities} />
        ) : (
          <Card asChild>
            <div className="panel">
              <EmptyState
                headingLevel={2}
                title={
                  hasFilters
                    ? 'No documents match just yet'
                    : archived
                      ? 'The archive is empty'
                      : 'Your library starts here'
                }
                description={
                  hasFilters
                    ? 'Try a broader search or clear your filters to see more documents.'
                    : archived
                      ? 'Archived documents will appear here with their version history.'
                      : 'Published guidance will appear here, ready for the whole team.'
                }
                href={
                  hasFilters
                    ? clearUrl
                    : canWrite(w.member) && !archived
                      ? '/docs/documents/new'
                      : undefined
                }
                label={hasFilters ? 'Clear filters' : 'Create a document'}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
