'use client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/modules/docs/shared/components/primitives/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/shadcn/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/modules/docs/shared/components/primitives/alert-dialog';

import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Textarea } from '@/components/shadcn/textarea';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cloud,
  CloudOff,
  Send,
  Pencil,
  Plus,
  Trash2,
  Paperclip,
  LockKeyhole,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { lockAction, saveDraftAction, submitAction } from '@/modules/docs/shared/actions';
import {
  type Workspace,
  type Draft,
  type DocumentContent,
  type RiskRow,
  type Attachment,
  DOC_STATUS_META,
  SELF_LOCK_MESSAGE,
  documentTypeLabels,
  riskBandMeta,
  UNCLASSIFIED_RISK_META,
} from '@/modules/docs/shared/types';
import { riskBand } from '@/modules/docs/shared/content';
import { RichEditor } from '@/modules/docs/shared/components/rich-editor';
import { Notice } from '@/components/ui-kit/notice';
import { Tag } from '@/components/ui-kit/tag';
import { PageHeader } from '@/components/ui-kit/page-header';
import { IconButton } from '@/components/ui/icon-button';
export function DocumentEditor({
  workspace: w,
  initial,
}: {
  workspace: Workspace;
  initial: Draft;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial.content);
  const contentRef = useRef(initial.content);
  const revision = useRef(initial.revision);
  const session = useRef('');
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [lockError, setLockError] = useState('');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [editorKey, setEditorKey] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<'write' | 'details'>('write');
  const [summary, setSummary] = useState(initial.changeSummary);
  const [approver, setApprover] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contributors, setContributors] = useState(initial.contributors);
  const titleId = useId();
  const summaryId = useId();
  const referenceId = useId();
  const ownerId = useId();
  const reviewId = useId();
  const changeId = useId();
  const approverId = useId();
  const saved = useRef(JSON.stringify(initial.content));
  const saving = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  function change(patch: Partial<DocumentContent>) {
    const next = { ...contentRef.current, ...patch };
    contentRef.current = next;
    setContent(next);
  }
  const acquire = useCallback(async (editSession = session.current, takeOver = false) => {
    const result = await lockAction(initial.documentId, editSession, false, takeOver);
    if (!mounted.current || session.current !== editSession) {
      if (result.ok) void lockAction(initial.documentId, editSession, true);
      return;
    }
    setLockError('');
    if (!result.ok) {
      setLocked(false);
      lockedRef.current = false;
      setLockError(result.error);
      return;
    }
    const latest = result.data!;
    if (latest.revision !== revision.current) {
      if (saved.current !== JSON.stringify(contentRef.current)) {
        setLockError(
          'A newer draft is available. Copy your unsaved changes before reloading this page.',
        );
        void lockAction(initial.documentId, session.current, true);
        return;
      }
      revision.current = latest.revision;
      contentRef.current = latest.content;
      setContent(latest.content);
      saved.current = JSON.stringify(latest.content);
      setEditorKey((k) => k + 1);
    }
    setContributors(latest.contributors);
    setLocked(true);
    lockedRef.current = true;
  }, [initial.documentId]);
  useEffect(() => {
    mounted.current = true;
    const editSession = crypto.randomUUID();
    session.current = editSession;
    void acquire(editSession);
    const heartbeat = setInterval(async () => {
      if (!lockedRef.current) return;
      const result = await lockAction(initial.documentId, session.current);
      if (!result.ok) {
        lockedRef.current = false;
        setLocked(false);
        setLockError(result.error);
      }
    }, 30000);
    const unload = (e: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(contentRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a');
      if (
        anchor?.href &&
        !anchor.hasAttribute('download') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        saved.current !== JSON.stringify(contentRef.current)
      ) {
        event.preventDefault();
        event.stopPropagation();
        setLeaveHref(anchor.href);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      mounted.current = false;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
      void lockAction(initial.documentId, editSession, true);
    };
  }, [acquire, initial.documentId]);
  const persist = useCallback(async (): Promise<boolean> => {
    if (saving.current) {
      const previous = await saving.current;
      if (!previous) return false;
    }
    if (saved.current === JSON.stringify(contentRef.current)) return true;
    if (!lockedRef.current) {
      setError('Reconnect your editing session before saving.');
      return false;
    }
    const payload = structuredClone(contentRef.current);
    setSaveStatus('Saving…');
    setError('');
    const task = (async () => {
      try {
        const result = await saveDraftAction(
          initial.documentId,
          session.current,
          revision.current,
          payload,
        );
        if (!result.ok) {
          setSaveStatus('Couldn’t save');
          setError(result.error);
          return false;
        }
        revision.current = result.data.revision;
        saved.current = JSON.stringify(payload);
        setContributors(result.data.contributors);
        setSaveStatus('Saved');
        return true;
      } catch {
        setSaveStatus('Couldn’t save');
        setError(
          'Connection interrupted. Your changes are still in this tab. Retry when connected.',
        );
        return false;
      }
    })();
    saving.current = task;
    const success = await task;
    if (saving.current === task) saving.current = null;
    return success;
  }, [initial.documentId]);
  useEffect(() => {
    if (!locked || saved.current === JSON.stringify(content)) return;
    const timer = setTimeout(() => {
      void persist();
    }, 900);
    return () => clearTimeout(timer);
  }, [content, locked, persist]);
  async function upload(file: File) {
    if (!lockedRef.current) throw new Error('Reconnect before uploading.');
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('documentId', initial.documentId);
      form.set('session', session.current);
      const response = await fetch('/api/docs/files', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed.');
      return result as Attachment;
    } finally {
      setUploading(false);
    }
  }
  const approvers = w.members.filter(
    (m) => m.active && m.access.approve && !contributors.includes(m.id) && m.id !== w.member.id,
  );
  const failed = saveStatus === 'Couldn’t save';
  const selfLocked = lockError === SELF_LOCK_MESSAGE;
  return (
    <Tabs
      value={editorView}
      onValueChange={(value) => setEditorView(value as 'write' | 'details')}
      className="authoring-workspace flex min-w-0 flex-col gap-4"
    >
      <PageHeader
        back={{ href: `/docs/documents/${initial.documentId}`, label: 'Document' }}
        title="Edit document"
        description="Changes stay in this draft until they are reviewed and approved"
        status={
          <>
            {initial.status === 'changes_requested' ? <Tag meta={DOC_STATUS_META.changesRequested} /> : null}
            <span
              className={`flex items-center gap-1.5 text-xs ${failed ? 'text-ui-destructive' : 'text-ui-muted-foreground'}`}
              role="status"
            >
              {failed ? <CloudOff aria-hidden="true" className="size-4" /> : <Cloud aria-hidden="true" className="size-4" />}
              {saveStatus}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" disabled={!locked || busy} onClick={() => void persist()}>
              Save now
            </Button>
            <Button
              disabled={!locked || busy || uploading}
              onClick={async () => {
                if (await persist()) setDialog(true);
              }}
            >
              <Send aria-hidden="true" />
              Submit for review
            </Button>
          </>
        }
      />
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      {lockError && (
        <Notice
          tone="error"
          live="alert"
          icon={LockKeyhole}
          title={lockError}
          actions={
            selfLocked ? (
              <Button variant="outline" onClick={() => void acquire(session.current, true)}>
                <Pencil aria-hidden="true" />
                Edit here
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void acquire()}>
                <RefreshCw aria-hidden="true" />
                Reconnect
              </Button>
            )
          }
        />
      )}
      {!locked && !lockError && <Notice live="status" title="Opening the editor…" />}
      {initial.feedback && (
        <Notice tone="warning" title="Reviewer feedback" description={initial.feedback} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Editor sections">
          <TabsTrigger value="write">Write document</TabsTrigger>
          <TabsTrigger value="details">Details and audience</TabsTrigger>
        </TabsList>
        <p className="text-xs text-ui-muted-foreground">Draft · Independent review · Published</p>
      </div>
      <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
        <div className="editor-columns">
          <section className="pc-panel min-w-0" aria-label="Document">
            <div className="flex flex-col gap-2">
              <Label className="block" htmlFor={titleId}>Document title</Label>
              <Input
                id={titleId}
                value={content.title}
                disabled={!locked}
                onChange={(e) => change({ title: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="block" htmlFor={summaryId}>Short summary</Label>
              <Textarea
                id={summaryId}
                value={content.summary}
                disabled={!locked}
                onChange={(e) => change({ summary: e.target.value })}
                maxLength={1200}
                placeholder="Explain what this document helps the reader do"
                rows={2}
              />
            </div>
            <RichEditor
              key={editorKey}
              value={content.body}
              disabled={!locked || busy}
              onChange={(body) => change({ body })}
              upload={upload}
            />
            {content.type === 'Risk assessment' && (
              <RiskEditor
                content={content}
                onChange={(riskRows) => change({ riskRows })}
                workspace={w}
                disabled={!locked || busy}
              />
            )}
            <section className="flex flex-col gap-3" aria-labelledby="attachments-title">
              <div>
                <h2 id="attachments-title">Reference attachments</h2>
                <p className="text-sm text-ui-muted-foreground">
                  Supporting PDF or Word documents, kept with each published version
                </p>
              </div>
              {content.attachments.length > 0 && (
                <ul className="pc-rows">
                  {content.attachments.map((file) => (
                    <li className="pc-row" key={file.id}>
                      <span className="pc-tile-icon"><Paperclip aria-hidden="true" /></span>
                      <span className="pc-row-body">
                        <a className="pc-row-title underline-offset-2 hover:underline" href={`/api/docs/files/${file.id}`}>{file.name}</a>
                        <span className="pc-row-hint">{(file.size / 1024).toFixed(0)} KB</span>
                      </span>
                      <IconButton
                        label={`Remove ${file.name}`}
                        disabled={!locked}
                        onClick={() =>
                          change({ attachments: content.attachments.filter((f) => f.id !== file.id) })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              <Label className="editor-drop-zone">
                <span className="pc-tile-icon"><Upload aria-hidden="true" /></span>
                <span className="font-semibold">{uploading ? 'Uploading…' : 'Choose a PDF or Word document'}</span>
                <span className="text-xs font-normal text-ui-muted-foreground">PDF or DOCX · Up to 4 MB per file</span>
                <Input
                  type="file"
                  className="sr-only w-px"
                  disabled={!locked || uploading}
                  accept=".pdf,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const a = await upload(file);
                        change({ attachments: [...contentRef.current.attachments, a] });
                      } catch (err) {
                        setError((err as Error).message);
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </Label>
            </section>
          </section>
          <aside className="pc-panel min-w-0" aria-labelledby="details-title">
            <h2 id="details-title">Document details</h2>
            <div className="flex flex-col gap-2">
              <Label className="block" htmlFor={referenceId}>Reference number</Label>
              <Input
                id={referenceId}
                disabled={!locked}
                value={content.reference}
                onChange={(e) => change({ reference: e.target.value })}
                maxLength={50}
              />
            </div>
            <dl>
              <dt className="text-xs text-ui-muted-foreground">Document type</dt>
              <dd className="font-semibold">{documentTypeLabels[content.type].long}</dd>
            </dl>
            <div className="flex flex-col gap-2">
              <Label className="block" htmlFor={ownerId}>Document owner</Label>
              <NativeSelect
                id={ownerId}
                disabled={!locked}
                value={content.ownerId}
                onChange={(e) => change({ ownerId: e.target.value })}
              >
                {w.members
                  .filter((m) => m.access.write)
                  .map((m) => (
                    <NativeSelectOption value={m.id} key={m.id}>
                      {m.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="block" htmlFor={reviewId}>Next review date</Label>
              <Input
                id={reviewId}
                type="date"
                disabled={!locked}
                value={content.reviewDate}
                onChange={(e) => change({ reviewDate: e.target.value })}
              />
            </div>
            <p className="text-xs text-ui-muted-foreground">
              {locked
                ? 'You’re editing. Others can read the document while you work.'
                : 'Editing opens once the editor is ready.'}
            </p>
          </aside>
        </div>
      </TabsContent>
      <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
        <section className="pc-panel" aria-labelledby="audience-title">
          <div>
            <h2 id="audience-title">Details and audience</h2>
            <p className="text-sm text-ui-muted-foreground">Who the document is for, and what it links to</p>
          </div>
          <div className="grid min-w-0 gap-6 md:grid-cols-[repeat(auto-fit,minmax(var(--pc-card-min),1fr))]">
            <ChoiceList
              legend="Facilities"
              items={w.facilities}
              chosen={content.facilityIds}
              disabled={!locked}
              onChange={(facilityIds) => change({ facilityIds })}
            />
            <ChoiceList
              legend="Teams"
              items={w.teams}
              chosen={content.teamIds}
              disabled={!locked}
              onChange={(teamIds) => change({ teamIds })}
            />
            <ChoiceList
              legend="Related documents"
              hint="Published guidance that supports this document"
              items={w.documents
                .filter((d) => d.currentVersionId && d.id !== initial.documentId)
                .map((d) => ({ id: d.id, name: d.content.title }))}
              chosen={content.relatedIds}
              disabled={!locked}
              onChange={(relatedIds) => change({ relatedIds })}
            />
          </div>
        </section>
      </TabsContent>
      <AlertDialog
        open={!!leaveHref}
        onOpenChange={(open) => {
          if (!open) setLeaveHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Some changes have not been saved. Keep editing to retry saving, or leave and discard
            those changes.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!leaveHref) return;
                saved.current = JSON.stringify(contentRef.current);
                window.location.assign(leaveHref);
              }}
            >
              Discard changes and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={dialog}
        onOpenChange={(open) => {
          if (!busy) setDialog(open);
        }}
      >
        <DialogContent className="flex flex-col gap-4" showCloseButton={!busy}>
          <DialogTitle>Send your draft for review</DialogTitle>
          <DialogDescription>
            The draft will be frozen until the reviewer approves it or requests changes.
          </DialogDescription>
          <div className="flex flex-col gap-2">
            <Label className="block" htmlFor={changeId}>What changed?</Label>
            <Textarea
              id={changeId}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              placeholder="A short summary for the reviewer and your team"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="block" htmlFor={approverId}>Approver</Label>
            <NativeSelect id={approverId} value={approver} onChange={(e) => setApprover(e.target.value)} required>
              <NativeSelectOption value="">Select an independent approver</NativeSelectOption>
              {approvers.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {!approvers.length && (
            <Notice
              tone="error"
              title="No independent approver available"
              description="An administrator must assign an active approver who has not edited this revision."
            />
          )}
          {error ? <Notice tone="error" live="alert" title={error} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              data-dialog-close
              disabled={busy}
              onClick={() => setDialog(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="default"
              disabled={busy || !approver || !summary.trim()}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  if (!(await persist())) return;
                  const result = await submitAction(
                    initial.documentId,
                    session.current,
                    revision.current,
                    approver,
                    summary,
                  );
                  if (!result.ok) setError(result.error);
                  else {
                    saved.current = JSON.stringify(contentRef.current);
                    lockedRef.current = false;
                    router.push(`/docs/documents/${initial.documentId}?version=${result.data}`);
                    router.refresh();
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Send aria-hidden="true" />
              {busy ? 'Submitting…' : 'Send for review'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
/** A group of checkboxes for the audience (facilities, teams, related documents): the legend as
 *  the field label, then 44px rows. The fieldset carries the lock (disabled while not editing). */
function ChoiceList({
  legend,
  hint,
  items,
  chosen,
  disabled,
  onChange,
}: {
  legend: string;
  hint?: string;
  items: { id: string; name: string }[];
  chosen: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="editor-choices" disabled={disabled}>
      <legend>{legend}</legend>
      {hint ? <p className="text-xs text-ui-muted-foreground">{hint}</p> : null}
      {items.length ? (
        items.map((item) => (
          <Label className="flex min-h-11 flex-row items-center gap-3 font-normal" key={item.id}>
            <Checkbox
              checked={chosen.includes(item.id)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...chosen, item.id] : chosen.filter((id) => id !== item.id))
              }
            />
            {item.name}
          </Label>
        ))
      ) : (
        <p className="text-sm text-ui-muted-foreground">None to choose from yet</p>
      )}
    </fieldset>
  );
}
function RiskEditor({
  content: c,
  onChange,
  workspace: w,
  disabled,
}: {
  content: DocumentContent;
  onChange: (rows: RiskRow[]) => void;
  workspace: Workspace;
  disabled: boolean;
}) {
  const update = (id: string, patch: Partial<RiskRow>) =>
    onChange(c.riskRows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
      <section className="flex flex-col gap-3" aria-labelledby="risk-editor-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="risk-editor-title">Risk assessment</h2>
            <p className="text-sm text-ui-muted-foreground">Hazards, their controls and the follow-up actions</p>
          </div>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...c.riskRows,
                {
                  id: crypto.randomUUID(),
                  hazard: '',
                  people: '',
                  controls: '',
                  initialLikelihood: 1,
                  initialSeverity: 1,
                  residualLikelihood: 1,
                  residualSeverity: 1,
                  actions: '',
                  ownerId: '',
                  dueDate: '',
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Add hazard
          </Button>
        </div>
        {!w.matrix.configured && (
          <Notice
            tone="error"
            title="The risk matrix must be configured in Administration before submission."
          />
        )}
        {!c.riskRows.length && (
          <p className="text-sm text-ui-muted-foreground">Add the first hazard to start the assessment</p>
        )}
        {c.riskRows.map((r, index) => (
          <fieldset className="risk-edit-row" key={r.id} disabled={disabled}>
            <legend className="sr-only">Hazard {index + 1}</legend>
            <div className="flex items-center justify-between gap-3">
              <strong>Hazard {index + 1}</strong>
              <IconButton
                type="button"
                label={`Remove hazard ${index + 1}`}
                onClick={() => onChange(c.riskRows.filter((row) => row.id !== r.id))}
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </div>
            <Label>
              Hazard
              <Input value={r.hazard} onChange={(e) => update(r.id, { hazard: e.target.value })} />
            </Label>
            <Label>
              People affected
              <Input value={r.people} onChange={(e) => update(r.id, { people: e.target.value })} />
            </Label>
            <Label>
              Existing controls
              <Textarea
                value={r.controls}
                onChange={(e) => update(r.id, { controls: e.target.value })}
              />
            </Label>
            <div className="risk-rating-grid">
              {(['initial', 'residual'] as const).map((stage) => {
                const score = r[`${stage}Likelihood`] * r[`${stage}Severity`];
                const band = riskBand(w.matrix, score);
                return (
                  <div className="risk-rating" key={stage}>
                    <h3>
                      {stage === 'initial' ? 'Initial risk' : 'Residual risk'}
                      <Tag
                        meta={riskBandMeta(band)}
                        label={`${score} · ${band?.label || UNCLASSIFIED_RISK_META.label}`}
                      />
                    </h3>
                    {(['Likelihood', 'Severity'] as const).map((metric) => (
                      <Label key={metric}>
                        {metric}
                        <NativeSelect
                          value={r[`${stage}${metric}`]}
                          onChange={(e) =>
                            update(r.id, { [`${stage}${metric}`]: Number(e.target.value) })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <NativeSelectOption key={n} value={n}>
                              {n} —{' '}
                              {w.matrix[metric === 'Likelihood' ? 'likelihood' : 'severity'][n - 1]
                                ?.label || `Level ${n}`}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Label>
                    ))}
                  </div>
                );
              })}
            </div>
            <Label>
              Additional actions
              <Textarea
                value={r.actions}
                onChange={(e) => update(r.id, { actions: e.target.value })}
              />
            </Label>
            <div className="form-grid">
              <Label>
                Action owner
                <NativeSelect
                  value={r.ownerId}
                  onChange={(e) => update(r.id, { ownerId: e.target.value })}
                >
                  <NativeSelectOption value="">Select staff member</NativeSelectOption>
                  {w.members
                    .filter((m) => m.active)
                    .map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>
                        {m.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Label>
              <Label>
                Action due date
                <Input
                  type="date"
                  value={r.dueDate}
                  onChange={(e) => update(r.id, { dueDate: e.target.value })}
                />
              </Label>
            </div>
          </fieldset>
        ))}
      </section>
  );
}
