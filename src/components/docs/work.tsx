'use client';
import { Card } from '@/components/shadcn/card';
import { SearchField } from '@/components/ui-kit/search-field';
import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  FilePenLine,
  ClipboardCheck,
  Plus,
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
import { PageHeading, DocIcon, EmptyState } from './ui';
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
            Icon: ClipboardCheck,
            description: 'Submissions assigned to you for independent approval.',
          },
          {
            id: 'drafts',
            label: 'Drafts in progress',
            count: editing.length,
            Icon: FilePenLine,
            description: 'Shared drafts, with requested changes first.',
          },
          {
            id: 'due',
            label: 'Review dates',
            count: due.length,
            Icon: Clock3,
            description: 'Documents you own that need reviewing within 30 days.',
          },
        ]
      : []),
  ];
  const queue = queues.find((q) => q.id === params.get('view')) || queues[0];
  if (!queue) {
    return (
      <div className="task-workspace">
        <PageHeading eyebrow="Personal workspace" title="My work" description="Authoring, reviews and review dates for people who write documents." />
        <EmptyState
          title="Your required reading is in Turnfin Me"
          description="Open Turnfin Me on your phone to read and acknowledge the documents assigned to you. You can still browse the library here."
          href="/docs/library"
          label="Browse library"
        />
      </div>
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
    <div className="task-workspace">
      <PageHeading
        eyebrow="Personal workspace"
        title="My work"
        description="A clear next step for every document."
        action={
          canWrite(w.member) ? (
            <Button asChild>
              <Link href="/docs/documents/new">
                <Plus size={17} aria-hidden="true" />
                Add a document
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="task-layout">
        <nav className="task-queues" aria-label="Work queues">
          {queues.map(({ id, label, count, Icon }) => (
            <Link
              key={id}
              href={url('view', id)}
              scroll={false}
              aria-current={queue.id === id ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <strong>{count}</strong>
            </Link>
          ))}
        </nav>
        <Card asChild>
          <section className="task-panel" aria-labelledby="queue-heading">
            <header className="task-panel-heading">
              <div>
                <h2 id="queue-heading">{queue.label}</h2>
                <p>{queue.description}</p>
              </div>
              <p className="text-sm text-ui-muted-foreground tabular-nums">
                {queue.count} {queue.count === 1 ? 'document' : 'documents'}
              </p>
            </header>
            <div className="task-filters">
              <form
                action="/docs/work"
                role="search"
                aria-label="Search this work queue"
              >
                <SearchField
                  label={`Search ${queue.label.toLowerCase()}`}
                  defaultValue={search}
                  placeholder="Title or reference"
                />
                <input type="hidden" name="view" value={queue.id} />
                {facility && <input type="hidden" name="facility" value={facility} />}
              </form>
              <Label>
                <span className="sr-only">Filter work by facility</span>
                <NativeSelect
                  value={facility}
                  onChange={(e) => router.push(url('facility', e.target.value), { scroll: false })}
                >
                  <NativeSelectOption value="">All facilities</NativeSelectOption>
                  {w.facilities.map((f) => (
                    <NativeSelectOption key={f.id} value={f.id}>
                      {f.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
            </div>
            <p className="task-result-count" role="status">
              {visible.length} {visible.length === 1 ? 'document' : 'documents'}
              {search ? ` matching “${search}”` : ''}
            </p>
            {visible.length ? (
              <ul className="task-list">
                {visible.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>
                      <DocIcon type={item.type} />
                      <div className="task-item-copy">
                        <strong>{item.title}</strong>
                        <span>
                          {item.reference} · {item.detail}
                        </span>
                        {item.feedback && (
                          <p className="task-feedback">Reviewer feedback: {item.feedback}</p>
                        )}
                      </div>
                      <Tag meta={DOC_STATUS_META[item.status]} />
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={
                  search
                    ? 'No matching documents'
                    : queue.id === 'drafts'
                      ? 'No drafts in progress'
                      : queue.id === 'reviews'
                        ? 'No reviews waiting'
                        : 'No reviews due soon'
                }
                description={
                  search
                    ? 'Clear your search to see all documents in this queue.'
                    : queue.description
                }
                href={
                  search
                    ? url('q', '')
                    : queue.id === 'drafts'
                      ? '/docs/documents/new'
                      : undefined
                }
                label={
                  search
                    ? 'Clear search'
                    : queue.id === 'drafts'
                      ? 'Create a document'
                      : 'Browse library'
                }
              />
            )}
          </section>
        </Card>
      </div>
    </div>
  );
}
