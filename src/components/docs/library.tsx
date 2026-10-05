'use client';

import { NativeSelectOption } from '@/components/shadcn/native-select';
import { SearchField } from '@/components/ui-kit/search-field';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Archive, ChevronLeft, ChevronRight, FilePlus2 } from 'lucide-react';
import {
  canWrite,
  documentTypeLabels,
  type DocumentType,
  type Workspace,
  type LibraryDocument,
} from '@/lib/docs/types';
import { Button } from '@/components/shadcn/button';
import { DocumentList } from './document-list';
import { FilterSelect } from './ui';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { SegmentedLinks } from '@/components/ui-kit/segmented-links';

/** The type filter always offers these four (V2Docs); Operations and Other join them only
 *  when documents in scope have that type. */
const mainTypes: DocumentType[] = ['EAP', 'Policy', 'SOP', 'Risk assessment'];
const extraTypes: DocumentType[] = ['NOP', 'Custom'];

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
  /** The library URL with one parameter changed (the type links and the archive switch). */
  function href(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    return `/docs/library${next.size ? `?${next}` : ''}`;
  }
  const types = [
    ...mainTypes,
    ...extraTypes.filter((t) => t === type || scoped.some((d) => d.content.type === t)),
  ];

  return (
    <>
      <PageHeader
        title={archived ? 'Document archive' : 'Document library'}
        description={
          archived
            ? 'Archived documents, kept with their full history'
            : 'Procedures, policies and risk assessments for your facility'
        }
        actions={
          canWrite(w.member) && !archived ? (
            <Button asChild>
              <Link href="/docs/documents/new">
                <FilePlus2 aria-hidden="true" />
                New document
              </Link>
            </Button>
          ) : undefined
        }
      />
      <section className="pc-panel" aria-label={archived ? 'Archived documents' : 'Documents'}>
        <div className="flex flex-wrap items-end gap-3">
          <form
            action="/docs/library"
            role="search"
            aria-label="Search the document library"
            className="min-w-0 flex-1 basis-64"
          >
            <SearchField
              label="Search documents"
              placeholder="Title, reference or text"
              defaultValue={query}
            />
            {type && <input type="hidden" name="type" value={type} />}
            {facility && <input type="hidden" name="facility" value={facility} />}
            {team && <input type="hidden" name="team" value={team} />}
            {archived && <input type="hidden" name="archived" value="true" />}
            {sort === 'title' && <input type="hidden" name="sort" value={sort} />}
          </form>
          {/* The bar wraps onto a second row on narrow screens; no type is ever scrolled away. */}
          <SegmentedLinks
            label="Document type"
            items={[
              { href: href('type', ''), label: 'All', current: !type },
              ...types.map((t) => ({ href: href('type', t), label: documentTypeLabels[t].many, current: type === t })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Facility" value={facility} onChange={(value) => filter('facility', value)} disabled={pending}>
            <NativeSelectOption value="">All facilities</NativeSelectOption>
            {w.facilities.map((f) => (
              <NativeSelectOption key={f.id} value={f.id}>
                {f.name}
              </NativeSelectOption>
            ))}
          </FilterSelect>
          <FilterSelect label="Team" value={team} onChange={(value) => filter('team', value)} disabled={pending}>
            <NativeSelectOption value="">All teams</NativeSelectOption>
            {w.teams.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort by" value={sort} onChange={(value) => filter('sort', value)} disabled={pending}>
            <NativeSelectOption value="recent">Recently published</NativeSelectOption>
            <NativeSelectOption value="title">Title, A–Z</NativeSelectOption>
          </FilterSelect>
          <Button asChild variant="outline" className="sm:ml-auto">
            {archived ? (
              <Link href={href('archived', '')}>
                <ChevronLeft aria-hidden="true" />
                Back to the library
              </Link>
            ) : (
              <Link href={href('archived', 'true')}>
                <Archive aria-hidden="true" />
                Archived documents
              </Link>
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3">
          <p role="status" className="text-xs text-ui-muted-foreground">
            {pending
              ? 'Updating documents…'
              : `${visible.length} ${visible.length === 1 ? 'document' : 'documents'}${query ? ` matching “${query}”` : ''}`}
          </p>
          {hasFilters && (
            <Button asChild variant="link">
              <Link href={clearUrl}>Clear filters</Link>
            </Button>
          )}
        </div>
        <div aria-busy={pending}>
          {visible.length ? (
            <DocumentList documents={visible} facilities={w.facilities} />
          ) : (
            <EmptyState
              as="h2"
              icon="book"
              title={hasFilters ? 'No documents match' : archived ? 'No archived documents' : 'No documents yet'}
              hint={
                hasFilters
                  ? 'Try a broader search, or clear the filters'
                  : archived
                    ? 'Archived documents appear here with their version history'
                    : 'Published documents appear here for the whole team'
              }
              action={
                hasFilters ? (
                  <Button asChild variant="outline">
                    <Link href={clearUrl}>
                      Clear filters
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : canWrite(w.member) && !archived ? (
                  <Button asChild variant="outline">
                    <Link href="/docs/documents/new">
                      New document
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
