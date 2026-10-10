'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, CheckCheck, ChevronRight, LifeBuoy, Pencil } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { SearchField } from '@/components/ui-kit/search-field';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { canWrite, documentTypeLabels, type DocumentType, type Workspace } from '@/modules/docs/shared/types';
import { DocIcon, FilterPicker } from '@/modules/docs/shared/components/ui';
import { cn } from '@/lib/utils';
import { DocumentList } from '@/modules/docs/shared/components/document-list';

const collections: { type: DocumentType; description: string }[] = [
  { type: 'SOP', description: 'Everyday tasks, step by step' },
  { type: 'NOP', description: 'How the facility runs each day' },
  { type: 'Policy', description: 'The rules everyone works to' },
  { type: 'Risk assessment', description: 'Hazards and their controls' },
];

/** The Docs overview (DCOverview): find a document, the emergency plans, the person's
 *  authoring work, the collections and what was published last. */
export function HomeView({ workspace: w, description }: { workspace: Workspace; description: string }) {
  const [facility, setFacility] = useState('');
  const matchesFacility = (ids: string[]) => !facility || !ids.length || ids.includes(facility);
  const documents = w.documents.filter(
    (d) => d.currentVersionId && matchesFacility(d.content.facilityIds),
  );
  const facilityQuery = facility ? `facility=${encodeURIComponent(facility)}` : '';
  const libraryUrl = `/docs/library${facilityQuery ? `?${facilityQuery}` : ''}`;
  const work = [
    ...(canWrite(w.member)
      ? [
          { href: '/docs/work?view=drafts', icon: Pencil, title: 'Continue a draft', hint: 'Pick up where the team left off' },
          { href: '/docs/work?view=reviews', icon: CheckCheck, title: 'Review submissions', hint: 'Decisions waiting for you' },
        ]
      : []),
    { href: libraryUrl, icon: BookOpen, title: 'Browse the library', hint: 'Every published document for your facility' },
  ];

  return (
    <>
      <PageHeader
        title="Docs"
        description={description}
        actions={
          <FilterPicker
            label="Facility"
            value={facility}
            onChange={setFacility}
            options={[{ value: '', label: 'All facilities' }, ...w.facilities.map((item) => ({ value: item.id, label: item.name }))]}
          />
        }
      />

      <section className="pc-panel" aria-label="Find a document">
        <form className="flex flex-wrap items-end gap-3" action="/docs/library" role="search" aria-label="Find a document">
          <SearchField
            label="Find a document"
            placeholder="Find a procedure, policy or document"
            className="max-w-xl flex-1 basis-64"
          />
          {facility && <input type="hidden" name="facility" value={facility} />}
          <Button type="submit">
            Search
            <ChevronRight aria-hidden="true" />
          </Button>
        </form>
      </section>

      <section className="pc-note flex-wrap items-center" data-tone="danger" aria-labelledby="emergency-title">
        <LifeBuoy aria-hidden="true" className="size-5" />
        <div className="min-w-0 flex-1 basis-48">
          <h2 id="emergency-title" className="text-sm">Emergency plans</h2>
          <p className="pc-row-hint">Approved responses for your facility</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/docs/library?type=EAP${facilityQuery ? `&${facilityQuery}` : ''}`}>
            Open plans
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="required-reading-title">
          <h2 id="required-reading-title">Your required reading</h2>
          {/* Personal records live in Turnfin Me, the staff app, never on Work. */}
          <EmptyState
            as="h3"
            icon="book"
            title="Read and acknowledge in Turnfin Me"
            hint="Documents assigned to you, their deadlines and your acknowledgements are in Turnfin Me on your phone. The library here is open for looking things up at work."
            action={
              <Button asChild variant="outline">
                <Link href={libraryUrl}>
                  Browse the library
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </section>

        <section className="pc-panel" aria-labelledby="your-work-title">
          <h2 id="your-work-title">Your work</h2>
          <ul className="pc-rows">
            {work.map(({ href, icon: Icon, title, hint }) => (
              <li key={title}>
                <Link className="pc-row" href={href}>
                  <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{title}</span>
                    <span className="pc-row-hint">{hint}</span>
                  </span>
                  <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="pc-panel" aria-labelledby="collections-title">
        <h2 id="collections-title">Collections</h2>
        {/* Four collections fit one row on a wide panel (DCOverview), two on a phone. */}
        <ul className="pc-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, var(--pc-tile-min)), 1fr))' }}>
          {collections.map(({ type, description }) => {
            const count = documents.filter((d) => d.content.type === type).length;
            return (
            <li key={type} className="flex min-w-0">
              <Link
                className="pc-stat w-full"
                href={`/docs/library?type=${encodeURIComponent(type)}${facilityQuery ? `&${facilityQuery}` : ''}`}
              >
                <DocIcon type={type} />
                <span>
                  <span className={cn('pc-stat-figure block', !count && 'text-ui-muted-foreground')}>{count}</span>
                  <span className="block font-semibold">{documentTypeLabels[type].many}</span>
                </span>
                <span className="text-xs text-ui-muted-foreground">{description}</span>
              </Link>
            </li>
            );
          })}
        </ul>
      </section>

      <section className="pc-panel" aria-labelledby="recent-heading">
        <div className="pc-panel-head">
          <h2 id="recent-heading">Recently published</h2>
          <Button asChild variant="link">
            <Link href={libraryUrl}>
              View all documents
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {documents.length ? (
          <DocumentList documents={documents.slice(0, 5)} facilities={w.facilities} />
        ) : (
          <EmptyState
            as="h3"
            icon="book"
            title="No published documents yet"
            hint="Approved documents for this facility appear here once they are published"
          />
        )}
      </section>
    </>
  );
}
