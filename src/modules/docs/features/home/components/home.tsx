'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, CheckCheck, ChevronRight, LifeBuoy, Pencil } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { SearchField } from '@/components/ui-kit/search-field';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { PageShell } from '@/components/ui-kit/page-shell';
import { Figure, Figures } from '@/components/ui-kit/figure';
import { RecordSection } from '@/components/ui-kit/record';
import { canWrite, documentTypeLabels, type DocumentType, type Workspace } from '@/modules/docs/shared/types';
import { FilterPicker, typeIcons } from '@/modules/docs/shared/components/ui';
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
    <PageShell spacing="roomy" header={<PageHeader
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
      />}>

      <section className="flex min-w-0 flex-col" aria-label="Find a document">
        <form className="flex flex-wrap items-end gap-3" action="/docs/library" role="search" aria-label="Find a document">
          <SearchField
            label="Find a document"
            placeholder="Find a procedure, policy or document"
            className="max-w-xl flex-1 basis-64"
          />
          {facility && <input type="hidden" name="facility" value={facility} />}
          <Button type="submit" variant="outline">
            Search
            <ChevronRight aria-hidden="true" />
          </Button>
        </form>
      </section>

      <ul className="pc-list" aria-label="Emergency plans">
        <li>
          <Link className="pc-row" href={`/docs/library?type=EAP${facilityQuery ? `&${facilityQuery}` : ''}`}>
            <span className="pc-tile-icon" data-tone="red"><LifeBuoy aria-hidden="true" /></span>
            <span className="pc-row-body">
              <span className="pc-row-title">Emergency plans</span>
              <span className="pc-row-hint">Approved responses for your facility</span>
            </span>
            <ChevronRight className="pc-row-chevron" aria-hidden="true" />
          </Link>
        </li>
      </ul>

      <div className="grid items-start gap-(--space-7) lg:grid-cols-2">
        <RecordSection id="required-reading-title" title="Your required reading">
          {/* Personal records live in Turnfin Me, the staff app, never in Turnfin. */}
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
        </RecordSection>

        <RecordSection id="your-work-title" title="Your work">
          <ul className="pc-list">
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
        </RecordSection>
      </div>

      <RecordSection id="collections-title" title="Collections">
        <Figures label="Collections">
          {collections.map(({ type, description }) => (
            <Figure key={type} icon={typeIcons[type]} label={documentTypeLabels[type].many} value={documents.filter((d) => d.content.type === type).length}
              hint={description} href={`/docs/library?type=${encodeURIComponent(type)}${facilityQuery ? `&${facilityQuery}` : ''}`} />
          ))}
        </Figures>
      </RecordSection>

      <RecordSection id="recent-heading" title="Recently published" aside={
          <Button asChild variant="link">
            <Link href={libraryUrl}>
              View all documents
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>}>
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
      </RecordSection>
    </PageShell>
  );
}
