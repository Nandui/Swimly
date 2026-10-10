'use client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/modules/docs/shared/components/primitives/alert-dialog';

import { Label } from '@/components/shadcn/label';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Textarea } from '@/components/shadcn/textarea';
import { Progress } from '@/components/shadcn/progress';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  History,
  Paperclip,
  Pencil,
  Printer,
  Send,
  Smartphone,
  Users,
} from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { SegmentedChoice } from '@/components/ui-kit/segmented-links';
import { PageHeader } from '@/components/ui-kit/page-header';
import {
  startDraftAction,
  reviewAction,
  assignAction,
  archiveAction,
} from '@/modules/docs/shared/actions';
import {
  canWrite,
  canManage,
  canApprove,
  formatDate,
  overdue,
  DOC_STATUS_META,
  documentTypeLabels,
  type Workspace,
  type DocumentRecord,
  type DocumentContent,
  type Draft,
  type Snapshot,
  type AssignmentRule,
} from '@/modules/docs/shared/types';
import { DocIcon, docTypeMeta } from '@/modules/docs/shared/components/ui';
import { Input as FieldInput } from '@/components/ui/input';
import { Notice } from '@/components/ui-kit/notice';
import { Tag } from '@/components/ui-kit/tag';

/** The reader's text sizes (V2Document's A−, A, A+): 16px is the default reading size. */
/** One fact in the document's meta grid: a box with its caption over the value, or one line on phones. */
const metaBox =
  'rounded-ui-md border border-ui-border px-4 py-3 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:justify-between max-sm:gap-x-3 max-sm:py-2';
const SIZES = [
  { value: '14', label: 'A−', name: 'Smaller text' },
  { value: '16', label: 'A', name: 'Default text size' },
  { value: '20', label: 'A+', name: 'Larger text' },
];
type Props = {
  workspace: Workspace;
  document: DocumentRecord;
  content: DocumentContent;
  selected?: Snapshot;
  draft?: Draft;
  acknowledgedAt: string | null;
  assignments?: AssignmentRule;
  /** Owner-only totals for the current version: never names. */
  readingTotals?: { assigned: number; completed: number; overdue: number } | null;
  toc: { id: string; label: string; level: number }[];
  children: React.ReactNode;
};
export function Reader({
  workspace: w,
  document: d,
  content: c,
  selected: s,
  draft,
  acknowledgedAt,
  assignments,
  readingTotals,
  toc,
  children,
}: Props) {
  const router = useRouter();
  const [size, setSize] = useState('16');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, start] = useTransition();
  const [archiving, setArchiving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const feedbackId = useId();
  const historical = s?.kind === 'publication' && s.id !== d.currentVersionId;
  const submitted = s?.kind === 'submission';
  const isOwner = canWrite(w.member) && (c.ownerId === w.member.id || canManage(w.member));
  const reviewable =
    submitted &&
    draft?.submissionId === s.id &&
    draft.status === 'in_review' &&
    s.approverId === w.member.id &&
    canApprove(w.member) &&
    !s.contributors.includes(w.member.id) &&
    !d.archivedAt;
  function action(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
    openCurrent = false,
  ) {
    setError('');
    setSuccess('');
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error || 'Could not save that. Try again.');
      else {
        setSuccess(message);
        setArchiving(false);
        if (openCurrent) router.push(`/docs/documents/${d.id}`);
        router.refresh();
      }
    });
  }
  function edit() {
    setError('');
    start(async () => {
      const result = await startDraftAction(d.id);
      if (!result.ok) setError(result.error);
      else router.push(`/docs/documents/${d.id}/edit`);
    });
  }
  const owner = w.members.find((m) => m.id === c.ownerId)?.name || 'Document owner';
  const places =
    c.facilityIds
      .map((id) => w.facilities.find((f) => f.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'All facilities';
  const contents = [
    ...toc.map((item) => ({ href: `#${item.id}`, label: item.label, nested: item.level > 2 })),
    ...(c.type === 'Risk assessment' ? [{ href: '#risk-assessment', label: 'Risk assessment', nested: false }] : []),
    ...(c.attachments.length ? [{ href: '#references', label: 'Reference attachments', nested: false }] : []),
    ...(c.relatedIds.length ? [{ href: '#related', label: 'Related documents', nested: false }] : []),
  ];
  const totals = readingTotals && readingTotals.assigned > 0 ? readingTotals : null;
  const owns = isOwner && !d.archivedAt;
  return (
    <div className="reader-workspace flex min-w-0 flex-col gap-4">
      <PageHeader
        back={{ href: '/docs/library', label: 'Document library' }}
        title={c.title}
        description={[c.summary.trim().replace(/\.$/, ''), `Owned by ${owner}`].filter(Boolean).join(' · ')}
        actions={
          <>
            <SegmentedChoice
              aria-label="Text size"
              value={size}
              onValueChange={setSize}
              options={SIZES.map(({ value, label, name }) => ({
                value,
                label: (
                  <>
                    <span aria-hidden="true">{label}</span>
                    <span className="sr-only">{name}</span>
                  </>
                ),
              }))}
            />
            <Button asChild variant="outline">
              <Link href={`/docs/documents/${d.id}/history`}>
                <History aria-hidden="true" />
                History
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              Print
            </Button>
            {canWrite(w.member) && !d.archivedAt && draft?.status !== 'in_review' && (
              <Button disabled={pending} onClick={edit}>
                <Pencil aria-hidden="true" />
                {draft ? 'Continue draft' : 'Edit document'}
              </Button>
            )}
          </>
        }
      />
      {error ? (
        <Notice tone="error" live="alert" title={error} />
      ) : success ? (
        <Notice tone="success" live="status" title={success} />
      ) : null}
      {historical && (
        <Notice
          tone="warning"
          title="You are reading a previous version."
          actions={
            <Button asChild variant="outline">
              <Link href={`/docs/documents/${d.id}`}>
                Open the current version
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      )}
      {submitted && (
        <Notice
          tone="warning"
          title="This is a frozen review submission. Staff use the current approved publication."
        />
      )}
      {d.archivedAt && (
        <Notice
          tone="warning"
          title={`Archived ${formatDate(d.archivedAt)}.`}
          description={d.archiveReason || undefined}
        />
      )}
      {draft && s?.kind === 'publication' && !historical && !d.archivedAt && (
        <Notice
          icon={FilePenLine}
          title={
            draft.status === 'in_review'
              ? 'A new revision is awaiting approval.'
              : 'A new draft is in progress.'
          }
          description="Staff continue to see this approved version."
          actions={
            <Button asChild variant="outline">
              <Link
                href={
                  draft.status === 'in_review'
                    ? `/docs/documents/${d.id}?version=${draft.submissionId}`
                    : `/docs/documents/${d.id}/edit`
                }
              >
                {draft.status === 'in_review' ? 'View submission' : 'Open draft'}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      )}
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <article
          className="pc-panel document-article min-w-0 grow-[999] basis-[560px]"
          style={{ '--reading-size': `${size}px` } as React.CSSProperties}
        >
          <div className="flex flex-wrap gap-2">
            <Tag meta={docTypeMeta(c.type)} />
            {submitted && !d.archivedAt ? (
              <Tag meta={DOC_STATUS_META.submitted} label="Review submission" />
            ) : (
              <Tag
                meta={
                  DOC_STATUS_META[
                    d.archivedAt ? 'archived' : !s ? 'draftPreview' : historical ? 'historical' : 'current'
                  ]
                }
              />
            )}
          </div>
          {/* Phones: one fact per line, caption left and value right, so no box is left alone. */}
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 max-sm:grid-cols-1 max-sm:gap-2">
            <div className={metaBox}>
              <dt className="text-xs text-ui-muted-foreground">Document ref.</dt>
              <dd className="font-semibold">{c.reference}</dd>
            </div>
            {s && (
              <div className={metaBox}>
                <dt className="text-xs text-ui-muted-foreground">{submitted ? 'Submitted' : 'Published'}</dt>
                <dd className="font-semibold">
                  {formatDate(s.createdAt)}
                  {s.version ? ` · version ${s.version}` : ''}
                </dd>
              </div>
            )}
            <div className={metaBox}>
              <dt className="text-xs text-ui-muted-foreground">Review due</dt>
              <dd className="flex flex-wrap items-center gap-2 font-semibold">
                {formatDate(c.reviewDate)}
                {overdue(c.reviewDate) && <Tag meta={DOC_STATUS_META.reviewOverdue} />}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ui-muted-foreground">For {places}</p>
          {children}
          {c.attachments.length > 0 && (
            <section className="flex flex-col gap-3" id="references" aria-labelledby="references-title">
              <h2 id="references-title">Reference attachments</h2>
              <ul className="pc-rows">
                {c.attachments.map((file) => (
                  <li key={file.id}>
                    <a className="pc-row" href={`/api/docs/files/${file.id}`}>
                      <span className="pc-tile-icon"><Paperclip aria-hidden="true" /></span>
                      <span className="pc-row-body">
                        <span className="pc-row-title">{file.name}</span>
                        <span className="pc-row-hint">{(file.size / 1024).toFixed(0)} KB · Reference file</span>
                      </span>
                      <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.relatedIds.length > 0 && (
            <section className="flex flex-col gap-3" id="related" aria-labelledby="related-title">
              <h2 id="related-title">Related documents</h2>
              <ul className="pc-rows">
                {c.relatedIds.map((id) => {
                  const related = w.documents.find((item) => item.id === id);
                  return (
                    <li key={id}>
                      <Link className="pc-row" href={`/docs/documents/${id}`}>
                        {related ? <DocIcon type={related.content.type} /> : <span className="pc-tile-icon"><FilePenLine aria-hidden="true" /></span>}
                        <span className="pc-row-body">
                          <span className="pc-row-title">{related?.content.title || 'Related document'}</span>
                          {related && <span className="pc-row-hint">{documentTypeLabels[related.content.type].long}</span>}
                        </span>
                        <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {s?.kind === 'publication' && !historical && !d.archivedAt && (
            <div className="pc-note" id="acknowledge">
              {acknowledgedAt ? <CheckCircle2 aria-hidden="true" className="size-5 text-ui-primary" /> : <Smartphone aria-hidden="true" className="size-5 text-ui-primary" />}
              <div className="min-w-0">
                <h3>{acknowledgedAt ? 'You’ve read this version' : 'Assigned to you?'}</h3>
                <p className="text-sm">
                  {acknowledgedAt
                    ? `Acknowledged on ${formatDate(acknowledgedAt)}.`
                    : `Confirm you have read it in Turnfin Me on your phone. It records version ${s.version} against your name.`}
                </p>
              </div>
            </div>
          )}
          <div className="print-footer">
            {c.reference} · {s?.version ? `Version ${s.version}` : 'Unpublished draft'} · Printed{' '}
            {formatDate(new Date().toISOString())}
          </div>
        </article>
        <aside className="reader-rail flex min-w-0 grow basis-[300px] flex-col gap-4">
          {/* Below 768px the contents would sit after the whole document, so it is left out (V2PhoneDocument). */}
          {contents.length > 0 && (
            <nav className="pc-panel max-md:hidden!" aria-labelledby="contents-title">
              <h2 id="contents-title">On this page</h2>
              <ul className="flex flex-col gap-2">
                {contents.map((item) => (
                  <li key={item.href}>
                    <a className="reader-contents-link" data-nested={item.nested || undefined} href={item.href}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {(totals || owns) && (
            <section className="pc-panel" aria-labelledby="reading-title">
              <h2 id="reading-title">Reading this version</h2>
              {totals ? (
                <div className="flex flex-col gap-2">
                  <p>
                    <span className="pc-stat-figure block">{totals.completed}</span>
                    <span className="text-xs text-ui-muted-foreground">
                      of {totals.assigned} {totals.assigned === 1 ? 'person has' : 'people have'} read it
                    </span>
                  </p>
                  <Progress value={(totals.completed / totals.assigned) * 100} aria-label="Read so far" />
                  {totals.overdue > 0 && <Tag meta={DOC_STATUS_META.overdue} label={`${totals.overdue} overdue`} className="self-start" />}
                </div>
              ) : (
                <p className="text-sm text-ui-muted-foreground">Nobody is assigned to read this version yet</p>
              )}
              {owns && (
                <div className="flex flex-col gap-2">
                  <FormDialog
                    trigger={
                      <Button variant="outline" className="w-full">
                        <Users aria-hidden="true" />
                        Assign required reading
                      </Button>
                    }
                    title="Assign required reading"
                    description="Choose teams or people. Each new version asks them to read it again."
                    submitLabel="Save assignments"
                    successMessage="Reading assignments updated"
                    portalClassName="turnfin-docs"
                    submit={async (form) => {
                      const result = await assignAction(
                        d.id,
                        form.getAll('memberIds').map(String),
                        form.getAll('teamIds').map(String),
                        String(form.get('due') || '') || null,
                      );
                      return result.ok ? { ok: true } : { ok: false, error: result.error };
                    }}
                    onSuccess={() => router.refresh()}
                  >
                    <fieldset className="flex flex-col">
                      <legend className="mb-2">Teams</legend>
                      {w.teams.map((t) => (
                        <Label className="flex min-h-11 flex-row items-center gap-3 font-normal" key={t.id}>
                          <Checkbox name="teamIds" value={t.id} defaultChecked={assignments?.teamIds.includes(t.id)} />
                          {t.name}
                        </Label>
                      ))}
                    </fieldset>
                    <fieldset className="flex flex-col">
                      <legend className="mb-2">Individual staff</legend>
                      {w.members
                        .filter((m) => m.access.read)
                        .map((m) => (
                          <Label className="flex min-h-11 flex-row items-center gap-3 font-normal" key={m.id}>
                            <Checkbox name="memberIds" value={m.id} defaultChecked={assignments?.memberIds.includes(m.id)} />
                            {m.name}
                          </Label>
                        ))}
                    </fieldset>
                    <FieldInput label="Deadline" optional type="date" name="due" defaultValue={assignments?.dueDate?.slice(0, 10) || ''} />
                  </FormDialog>
                  <Button variant="ghost" onClick={() => setArchiving(true)}>
                    <Archive aria-hidden="true" />
                    Archive document
                  </Button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
      {reviewable && (
        <section className="pc-panel" aria-labelledby="review-title">
          <div>
            <h2 id="review-title">Ready for the team?</h2>
            <p className="text-sm text-ui-muted-foreground">Change summary: {s.changeSummary}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="block" htmlFor={feedbackId}>Review feedback</Label>
            <Textarea
              id={feedbackId}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Required when requesting changes, optional when approving"
              maxLength={5000}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending || !feedback.trim()}
              onClick={() =>
                action(
                  () => reviewAction(d.id, s.id, 'changes_requested', feedback),
                  'Changes requested. The author can revise the draft.',
                )
              }
            >
              <Send aria-hidden="true" />
              Request changes
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                action(
                  () => reviewAction(d.id, s.id, 'approved', feedback),
                  'Approved and published.',
                  true,
                )
              }
            >
              <CheckCircle2 aria-hidden="true" />
              Approve and publish
            </Button>
          </div>
        </section>
      )}
      <AlertDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open && !pending) setArchiving(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Archive this document</AlertDialogTitle>
          <AlertDialogDescription>
            The document leaves the library and outstanding reading lists. Its history is kept.
          </AlertDialogDescription>
          <div className="flex flex-col gap-2">
            <Label className="block" htmlFor={reasonId}>Reason for archiving</Label>
            <Textarea
              id={reasonId}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </div>
          {error ? <Notice tone="error" live="alert" title={error} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() => action(() => archiveAction(d.id, reason), 'Document archived.')}
            >
              {pending ? 'Archiving…' : 'Archive document'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
