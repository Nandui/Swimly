'use client';
import { SearchField } from '@/components/ui-kit/search-field';
import { NativeSelectOption } from '@/components/shadcn/native-select';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CheckCheck,
  ChevronRight,
  FilePlus2,
  Pencil,
} from 'lucide-react';
import {
  formatDate,
  canWrite,
  overdue,
  DOC_STATUS_META,
  type DocStatus,
  type Workspace,
  type Draft,
  type DocumentType,
} from '@/lib/docs/types';
import { Tag } from '@/components/ui-kit/tag';
import { DocIcon, FilterSelect } from './ui';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { Button } from '@/components/shadcn/button';

export function WorkView({ workspace: w, drafts }: { workspace: Workspace; drafts: Draft[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const facility = params.get('facility') || '';
  const search = params.get('q') || '';
  const scope = (ids: string[]) => !facility || !ids.length || ids.includes(facility);
  const review = drafts.filter(
    (d) => scope(d.content.facilityIds) && d.status === 'in_review' && d.approverId === w.member.id,
  );
  const editing = drafts
    .filter((d) => scope(d.content.facilityIds) && d.status !== 'in_review')
    .sort(
      (a, b) => Number(b.status === 'changes_requested') - Number(a.status === 'changes_requested'),
    );
  const due = w.documents
    .filter(
      (d) =>
        scope(d.content.facilityIds) &&
        d.content.ownerId === w.member.id &&
        d.currentVersionId &&
        new Date(d.content.reviewDate).getTime() < Date.parse(w.now) + 30 * 86400000,
    )
    .sort((a, b) => a.content.reviewDate.localeCompare(b.content.reviewDate));
  // Required reading and its history are personal: they live in Turnfin Me.
  // Work keeps the authoring queues.
  const queues = [
    ...(canWrite(w.member)
      ? [
          {
            id: 'reviews',
            label: 'Awaiting my review',
            count: review.length,
            Icon: CheckCheck,
            description: 'Submissions assigned to you for independent approval',
            empty: 'Nothing is waiting for your approval',
          },
          {
            id: 'drafts',
            label: 'Drafts in progress',
            count: editing.length,
            Icon: Pencil,
            description: 'Shared drafts, with requested changes first',
            empty: 'Start a document and its draft appears here',
          },
          {
            id: 'due',
            label: 'Review dates',
            count: due.length,
            Icon: CalendarClock,
            description: 'Documents you own that need reviewing within 30 days',
            empty: 'None of your documents needs reviewing in the next 30 days',
          },
        ]
      : []),
  ];
  const queue = queues.find((q) => q.id === params.get('view')) || queues[0];
  if (!queue) {
    return (
      <>
        <PageHeader title="My work" description="Authoring, reviews and review dates for people who write documents" />
        <EmptyState
          as="h2"
          icon="book"
          title="Your required reading is in Turnfin Me"
          hint="Open Turnfin Me on your phone to read and acknowledge the documents assigned to you. You can still browse the library here."
          action={
            <Button asChild variant="outline">
              <Link href="/docs/library">
                Browse the library
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </>
    );
  }
  function url(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    return `/docs/work?${next}`;
  }
  type Item = {
    id: string;
    title: string;
    reference: string;
    type: DocumentType;
    href: string;
    detail: string;
    status: DocStatus;
    feedback?: string;
  };
  let items: Item[];
  if (queue.id === 'due') {
    items = due.map((d) => ({
      id: d.id,
      title: d.content.title,
      reference: d.content.reference,
      type: d.content.type,
      href: `/docs/documents/${d.id}`,
      detail: `Review due ${formatDate(d.content.reviewDate)}`,
      status: overdue(d.content.reviewDate) ? 'overdue' : 'reviewDue',
    }));
  } else {
    items = (queue.id === 'reviews' ? review : editing).map((d) => ({
      id: d.documentId,
      title: d.content.title,
      reference: d.content.reference,
      type: d.content.type,
      href:
        queue.id === 'reviews'
          ? `/docs/documents/${d.documentId}?version=${d.submissionId}`
          : `/docs/documents/${d.documentId}/edit`,
      detail: `Updated ${formatDate(d.updatedAt)}`,
      status:
        d.status === 'changes_requested'
          ? 'changesRequested'
          : d.status === 'in_review'
            ? 'forYourReview'
            : 'draft',
      feedback: d.feedback,
    }));
  }
  const visible = items.filter((item) =>
    `${item.title} ${item.reference}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="My work"
        description="A clear next step for every document"
        actions={
          canWrite(w.member) ? (
            <Button asChild>
              <Link href="/docs/documents/new">
                <FilePlus2 aria-hidden="true" />
                New document
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <nav className="pc-panel" aria-labelledby="queues-heading">
          <h2 id="queues-heading">Queues</h2>
          <ul className="pc-rows">
            {queues.map(({ id, label, count, Icon }) => (
              <li key={id}>
                <Link
                  className="pc-row"
                  href={url('view', id)}
                  scroll={false}
                  aria-current={queue.id === id ? 'page' : undefined}
                >
                  <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
                  <span className="pc-row-title min-w-0 flex-1">{label}</span>
                  <span className="pc-row-count">{count}</span>
                  <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section className="pc-panel" aria-labelledby="queue-heading">
          <div>
            <h2 id="queue-heading">{queue.label}</h2>
            <p className="text-sm text-ui-muted-foreground">{queue.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <form
              action="/docs/work"
              role="search"
              aria-label={`Search ${queue.label.toLowerCase()}`}
              className="min-w-0 flex-1 basis-64"
            >
              <SearchField
                label={`Search ${queue.label.toLowerCase()}`}
                defaultValue={search}
                placeholder="Title or reference"
              />
              <input type="hidden" name="view" value={queue.id} />
              {facility && <input type="hidden" name="facility" value={facility} />}
            </form>
            <FilterSelect
              label="Facility"
              value={facility}
              onChange={(value) => router.push(url('facility', value), { scroll: false })}
            >
              <NativeSelectOption value="">All facilities</NativeSelectOption>
              {w.facilities.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  {f.name}
                </NativeSelectOption>
              ))}
            </FilterSelect>
          </div>
          <p className="text-xs text-ui-muted-foreground" role="status">
            {visible.length} {visible.length === 1 ? 'document' : 'documents'}
            {search ? ` matching “${search}”` : ''}
          </p>
          {visible.length ? (
            <ul className="pc-rows">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link className="pc-row" href={item.href}>
                    <DocIcon type={item.type} />
                    <span className="pc-row-body">
                      <span className="pc-row-title">{item.title}</span>
                      <span className="pc-row-hint">
                        {item.reference} · {item.detail}
                        {item.feedback ? ` · Reviewer feedback: ${item.feedback}` : ''}
                      </span>
                    </span>
                    <span className="pc-row-trail">
                      <Tag meta={DOC_STATUS_META[item.status]} />
                      <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              as="h3"
              icon="book"
              title={
                search
                  ? 'No documents match'
                  : queue.id === 'drafts'
                    ? 'No drafts in progress'
                    : queue.id === 'reviews'
                      ? 'No reviews waiting'
                      : 'No reviews due soon'
              }
              hint={search ? 'Clear the search to see every document in this queue' : queue.empty}
              action={
                search ? (
                  <Button asChild variant="outline">
                    <Link href={url('q', '')}>
                      Clear search
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : queue.id === 'drafts' ? (
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
        </section>
      </div>
    </>
  );
}
