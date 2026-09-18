'use client';
import { Alert } from '@/components/shadcn/alert';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/docs/primitives/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/docs/primitives/alert-dialog';

import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Textarea } from '@/components/shadcn/textarea';
import { Input } from '@/components/shadcn/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/docs/primitives/popover';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FilePenLine,
  History,
  Printer,
  Minus,
  Plus,
  Paperclip,
  Archive,
  Users,
  Send,
  ArrowRight,
} from 'lucide-react';
import {
  acknowledgeAction,
  startDraftAction,
  reviewAction,
  assignAction,
  archiveAction,
} from '@/app/docs/actions';
import {
  canWrite,
  canManage,
  canRead,
  canApprove,
  formatDate,
  overdue,
  type Workspace,
  type DocumentRecord,
  type DocumentContent,
  type Draft,
  type Snapshot,
  type AssignmentRule,
} from '@/lib/docs/types';
import { DocIcon, Badge, Message, Avatar } from './ui';
type Props = {
  workspace: Workspace;
  document: DocumentRecord;
  content: DocumentContent;
  selected?: Snapshot;
  draft?: Draft;
  acknowledgedAt: string | null;
  assignments?: AssignmentRule;
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
  toc,
  children,
}: Props) {
  const router = useRouter();
  const [size, setSize] = useState(18);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<'assign' | 'archive' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const [people, setPeople] = useState(assignments?.memberIds || []);
  const [teams, setTeams] = useState(assignments?.teamIds || []);
  const [due, setDue] = useState(assignments?.dueDate?.slice(0, 10) || '');
  const [contentsOpen, setContentsOpen] = useState(false);
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
      if (!result.ok) setError(result.error || 'Please try again.');
      else {
        setSuccess(message);
        setDialog(null);
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
  const ReaderDialog = dialog === 'archive' ? AlertDialog : Dialog;
  const ReaderDialogContent = dialog === 'archive' ? AlertDialogContent : DialogContent;
  const ReaderDialogTitle = dialog === 'archive' ? AlertDialogTitle : DialogTitle;
  const ReaderDialogDescription = dialog === 'archive' ? AlertDialogDescription : DialogDescription;
  return (
    <div className="reader-workspace">
      <div className="breadcrumb">
        <Link href="/docs/library">
          <ArrowLeft size={15} />
          Library
        </Link>
        <span>/</span>
        <span>{c.reference}</span>
      </div>
      <div className="reader-toolbar">
        <div className="reader-status">
          <Badge
            tone={
              d.archivedAt ? 'neutral' : submitted || !s ? 'amber' : historical ? 'amber' : 'green'
            }
          >
            {d.archivedAt
              ? 'Archived'
              : submitted
                ? 'Review submission'
                : !s
                  ? 'Draft preview'
                  : historical
                    ? 'Historical version'
                    : 'Current approved version'}
          </Badge>
          {s?.version && <span>Version {s.version}</span>}
        </div>
        <div className="reader-actions">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Reading options</Button>
            </PopoverTrigger>
            <PopoverContent
              className="reader-option-controls"
              align="end"
              aria-label="Reading options"
            >
              <span>Text size</span>
              <Button
                variant="ghost"
                className="icon-button"
                aria-label="Decrease text size"
                disabled={size <= 16}
                onClick={() => setSize((v) => v - 1)}
              >
                <Minus size={16} />
              </Button>
              <span className="text-size">Aa</span>
              <Button
                variant="ghost"
                className="icon-button"
                aria-label="Increase text size"
                disabled={size >= 24}
                onClick={() => setSize((v) => v + 1)}
              >
                <Plus size={16} />
              </Button>
              <Button
                variant="ghost"
                className="button ghost compact"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print / PDF</span>
              </Button>
            </PopoverContent>
          </Popover>
          <Button asChild variant="ghost">
            <Link className="button ghost compact" href={`/docs/documents/${d.id}/history`}>
              <History size={16} />
              <span>History</span>
            </Link>
          </Button>
          {canWrite(w.member) && !d.archivedAt && draft?.status !== 'in_review' && (
            <Button
              variant="outline"
              className="button secondary compact"
              disabled={pending}
              onClick={edit}
            >
              <FilePenLine size={16} />
              {draft ? 'Continue draft' : 'Edit document'}
            </Button>
          )}
        </div>
      </div>
      <Message error={error} success={success} />
      {historical && (
        <Alert role="status" className="notice warning">
          You are reading a previous version.
          <Link href={`/docs/documents/${d.id}`}>
            Open the current approved version <ArrowRight size={15} />
          </Link>
        </Alert>
      )}
      {submitted && (
        <Alert role="status" className="notice warning">
          This is a frozen review submission. Staff use the current approved publication.
        </Alert>
      )}
      {d.archivedAt && (
        <Alert role="status" className="notice warning">
          Archived {formatDate(d.archivedAt)}. {d.archiveReason}
        </Alert>
      )}
      {draft && s?.kind === 'publication' && !historical && !d.archivedAt && (
        <div className="draft-notice">
          <FilePenLine size={17} />
          <span>
            {draft.status === 'in_review'
              ? 'A new revision is awaiting approval.'
              : 'A new draft is in progress.'}{' '}
            Staff continue to see this approved version.
          </span>
          <Link
            href={
              draft.status === 'in_review'
                ? `/docs/documents/${d.id}?version=${draft.submissionId}`
                : `/docs/documents/${d.id}/edit`
            }
          >
            {draft.status === 'in_review' ? 'View submission' : 'Open draft'}
            <ArrowUpRightIcon />
          </Link>
        </div>
      )}
      <div className="reading-layout">
        <Button
          className="reader-contents-toggle"
          variant="outline"
          aria-expanded={contentsOpen}
          aria-controls="reader-contents"
          onClick={() => setContentsOpen(!contentsOpen)}
        >
          {contentsOpen ? 'Hide document contents' : 'Jump to a section'}
        </Button>
        <article
          className="document-paper"
          style={{ '--reading-size': `${size}px` } as React.CSSProperties}
        >
          <header className="document-header">
            <div className="document-kicker">
              <DocIcon type={c.type} />
              <span>
                {c.type === 'SOP'
                  ? 'STANDARD OPERATING PROCEDURE'
                  : c.type === 'NOP'
                    ? 'NORMAL OPERATING PROCEDURE'
                    : c.type === 'EAP'
                      ? 'EMERGENCY ACTION PLAN'
                      : c.type.toUpperCase()}
              </span>
            </div>
            <h1>{c.title}</h1>
            <p className="document-summary">{c.summary}</p>
            <div className="document-meta">
              <div>
                <span>DOCUMENT REF.</span>
                <strong>{c.reference}</strong>
              </div>
              <div>
                <span>{submitted ? 'SUBMITTED' : 'PUBLISHED'}</span>
                <strong>{formatDate(s?.createdAt)}</strong>
              </div>
              <div>
                <span>REVIEW DUE</span>
                <strong className={overdue(c.reviewDate) ? 'overdue-text' : ''}>
                  {formatDate(c.reviewDate)}
                  {overdue(c.reviewDate) && ' · Overdue'}
                </strong>
              </div>
            </div>
            <div className="document-owner">
              <Avatar
                small
                member={w.members.find((m) => m.id === c.ownerId) || { name: 'Document owner' }}
              />
              <span>
                Owned by{' '}
                <strong>
                  {w.members.find((m) => m.id === c.ownerId)?.name || 'Document owner'}
                </strong>
              </span>
              <span className="owner-facility">
                {c.facilityIds
                  .map((id) => w.facilities.find((f) => f.id === id)?.name)
                  .join(' · ') || 'All facilities'}
              </span>
            </div>
          </header>
          {children}
          {c.attachments.length > 0 && (
            <section className="attachments-section" id="references">
              <h2>Reference attachments</h2>
              {c.attachments.map((file) => (
                <a key={file.id} href={`/api/docs/files/${file.id}`} className="attachment">
                  <Paperclip size={18} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>{(file.size / 1024).toFixed(0)} KB · Reference file</small>
                  </span>
                  <ArrowRight size={17} />
                </a>
              ))}
            </section>
          )}
          {c.relatedIds.length > 0 && (
            <section className="attachments-section">
              <h2>Related documents</h2>
              {c.relatedIds.map((id) => (
                <Link className="attachment" key={id} href={`/docs/documents/${id}`}>
                  <FilePenLine size={18} />
                  {w.documents.find((item) => item.id === id)?.content.title || 'Related document'}
                  <ArrowRight size={17} />
                </Link>
              ))}
            </section>
          )}
          {s?.kind === 'publication' && !historical && !d.archivedAt && (
            <div className="acknowledgement" id="acknowledge">
              {acknowledgedAt ? (
                <>
                  <CheckCircle2 size={25} />
                  <div>
                    <h3>You’ve read this version</h3>
                    <p>Acknowledged on {formatDate(acknowledgedAt)}.</p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 size={25} />
                  <div>
                    <h3>All read?</h3>
                    <p>Confirm that you have read version {s.version} of this document.</p>
                  </div>
                  <Button
                    variant="default"
                    className="button primary"
                    disabled={pending}
                    onClick={() =>
                      action(
                        () => acknowledgeAction(d.id, s.id),
                        'Your acknowledgement has been recorded.',
                      )
                    }
                  >
                    <Check size={17} />I have read this version
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="print-footer">
            {c.reference} · {s?.version ? `Version ${s.version}` : 'Unpublished draft'} · Printed{' '}
            {formatDate(new Date().toISOString())}
          </div>
        </article>
        <aside className="reading-sidebar" data-contents-open={contentsOpen}>
          <div className="contents-panel" id="reader-contents">
            <p className="eyebrow">ON THIS PAGE</p>
            <nav aria-label="Document contents">
              {toc.map((item) => (
                <a
                  key={item.id}
                  className={item.level > 2 ? 'nested' : ''}
                  href={`#${item.id}`}
                  onClick={() => setContentsOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              {c.type === 'Risk assessment' && (
                <a href="#risk-assessment" onClick={() => setContentsOpen(false)}>
                  Risk assessment
                </a>
              )}
              {c.attachments.length > 0 && (
                <a href="#references" onClick={() => setContentsOpen(false)}>
                  Reference attachments
                </a>
              )}
            </nav>
          </div>
          <div className="reader-note">
            <CheckCircle2 size={19} />
            <strong>
              {s?.kind === 'publication' ? 'Version-controlled guidance' : 'Work in progress'}
            </strong>
            <p>
              {s?.kind === 'publication'
                ? 'Changes are reviewed before a new version reaches your team.'
                : 'This content becomes staff guidance only after independent approval.'}
            </p>
          </div>
          {isOwner && !d.archivedAt && (
            <div className="owner-actions">
              <Button
                variant="outline"
                className="button secondary"
                onClick={() => setDialog('assign')}
              >
                <Users size={16} />
                Assign required reading
              </Button>
              <Button variant="ghost" className="button ghost" onClick={() => setDialog('archive')}>
                <Archive size={16} />
                Archive document
              </Button>
            </div>
          )}
        </aside>
      </div>
      {reviewable && (
        <Card asChild>
          <section className="review-decision panel">
            <div>
              <Badge tone="amber">YOUR REVIEW</Badge>
              <h2>Ready for the team?</h2>
              <p>Change summary: {s.changeSummary}</p>
            </div>
            <Label>
              Review feedback
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Required when requesting changes. Optional when approving."
                maxLength={5000}
              />
            </Label>
            <div className="form-actions">
              <Button
                variant="outline"
                className="button secondary"
                disabled={pending || !feedback.trim()}
                onClick={() =>
                  action(
                    () => reviewAction(d.id, s.id, 'changes_requested', feedback),
                    'Changes requested. The author can revise the draft.',
                  )
                }
              >
                <Send size={16} />
                Request changes
              </Button>
              <Button
                variant="default"
                className="button primary"
                disabled={pending}
                onClick={() =>
                  action(
                    () => reviewAction(d.id, s.id, 'approved', feedback),
                    'Approved and published.',
                    true,
                  )
                }
              >
                <CheckCircle2 size={17} />
                Approve and publish
              </Button>
            </div>
          </section>
        </Card>
      )}
      <ReaderDialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <ReaderDialogContent className="workflow-dialog">
          <ReaderDialogTitle>
            {dialog === 'assign' ? 'Assign required reading' : 'Archive this document'}
          </ReaderDialogTitle>
          {dialog === 'assign' ? (
            <>
              <ReaderDialogDescription>
                Select staff or teams. New publications will require a fresh acknowledgement.
              </ReaderDialogDescription>
              <fieldset>
                <legend>Teams</legend>
                {w.teams.map((t) => (
                  <Label className="checkbox-label" key={t.id}>
                    <Checkbox
                      checked={teams.includes(t.id)}
                      onCheckedChange={(checked) =>
                        setTeams((v) =>
                          checked === true ? [...v, t.id] : v.filter((id) => id !== t.id),
                        )
                      }
                    />
                    {t.name}
                  </Label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Individual staff</legend>
                {w.members
                  .filter(canRead)
                  .map((m) => (
                    <Label className="checkbox-label" key={m.id}>
                      <Checkbox
                        checked={people.includes(m.id)}
                        onCheckedChange={(checked) =>
                          setPeople((v) =>
                            checked === true ? [...v, m.id] : v.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.name}
                    </Label>
                  ))}
              </fieldset>
              <Label>
                Optional deadline
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Label>
            </>
          ) : (
            <>
              <ReaderDialogDescription>
                The document leaves the library and outstanding reading lists. Its history will be
                retained.
              </ReaderDialogDescription>
              <Label>
                Reason for archiving
                <Textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                />
              </Label>
            </>
          )}
          <Message error={error} />
          <div className="form-actions">
            {dialog === 'archive' ? (
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            ) : (
              <Button
                variant="outline"
                data-dialog-close
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
            )}
            <Button
              variant={dialog === 'archive' ? 'destructive' : 'default'}
              disabled={pending || (dialog === 'archive' && !reason.trim())}
              onClick={() =>
                dialog === 'assign'
                  ? action(
                      () => assignAction(d.id, people, teams, due || null),
                      'Reading assignments updated.',
                    )
                  : action(() => archiveAction(d.id, reason), 'Document archived.')
              }
            >
              {pending ? 'Saving…' : dialog === 'assign' ? 'Save assignments' : 'Archive document'}
            </Button>
          </div>
        </ReaderDialogContent>
      </ReaderDialog>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}
