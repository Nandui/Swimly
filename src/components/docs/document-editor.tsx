'use client';
import { Alert } from '@/components/shadcn/alert';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/docs/primitives/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/shadcn/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/docs/primitives/alert-dialog';

import { Label } from '@/components/shadcn/label';
import { Card } from '@/components/shadcn/card';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Textarea } from '@/components/shadcn/textarea';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Send,
  Plus,
  Trash2,
  Paperclip,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react';
import { lockAction, saveDraftAction, submitAction } from '@/app/docs/actions';
import {
  canApprove,
  canWrite,
  type Workspace,
  type Draft,
  type DocumentContent,
  type RiskRow,
  type Attachment,
} from '@/lib/docs/types';
import { riskBand } from '@/lib/docs/content';
import { RichEditor } from './rich-editor';
import { Badge, Message } from './ui';
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
  const saved = useRef(JSON.stringify(initial.content));
  const saving = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  function change(patch: Partial<DocumentContent>) {
    const next = { ...contentRef.current, ...patch };
    contentRef.current = next;
    setContent(next);
  }
  const acquire = useCallback(async (editSession = session.current) => {
    const result = await lockAction(initial.documentId, editSession);
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
    (m) => m.active && canApprove(m) && !contributors.includes(m.id) && m.id !== w.member.id,
  );
  return (
    <Tabs
      value={editorView}
      onValueChange={(value) => setEditorView(value as 'write' | 'details')}
      className="authoring-workspace"
    >
      <div className="breadcrumb">
        <Link href={`/docs/documents/${initial.documentId}`}>
          <ArrowLeft size={15} />
          Document
        </Link>
        <span>/</span>
        <span>Edit draft</span>
      </div>
      <div className="editor-page-heading">
        <div>
          <Badge tone="amber">
            {initial.status === 'changes_requested' ? 'Changes requested' : 'Draft'}
          </Badge>
          <h1>Edit document</h1>
          <p>Changes stay in this draft until they are reviewed and approved.</p>
        </div>
        <div className="editor-page-actions">
          <span
            className={`save-status ${saveStatus === 'Couldn’t save' ? 'save-error' : ''}`}
            role="status"
          >
            {saveStatus === 'Couldn’t save' ? <CloudOff size={17} /> : <Cloud size={17} />}{' '}
            {saveStatus}
          </span>
          <Button
            variant="outline"
            className="button secondary"
            disabled={!locked || busy}
            onClick={() => void persist()}
          >
            Save now
          </Button>
          <Button
            variant="default"
            className="button primary"
            disabled={!locked || busy || uploading}
            onClick={async () => {
              if (await persist()) setDialog(true);
            }}
          >
            <Send size={17} />
            Submit for review
          </Button>
        </div>
      </div>
      <Message error={error} />
      {lockError && (
        <Alert role="status" className="notice error">
          <LockKeyhole size={19} />
          <span>{lockError}</span>
          <Button variant="outline" className="button secondary compact" onClick={() => void acquire()}>
            <RefreshCw size={15} />
            Reconnect
          </Button>
        </Alert>
      )}
      {!locked && !lockError && (
        <Alert role="status" className="notice">
          Acquiring your editing session…
        </Alert>
      )}
      <div className="editor-section-switch">
        <TabsList aria-label="Editor sections">
          <TabsTrigger value="write">Write document</TabsTrigger>
          <TabsTrigger value="details">Details & audience</TabsTrigger>
        </TabsList>
        <span>Draft → Independent review → Published</span>
      </div>
      {initial.feedback && (
        <Alert role="status" className="notice warning">
          <strong>Reviewer feedback:</strong> {initial.feedback}
        </Alert>
      )}
      <div className="editor-layout" data-editor-view={editorView}>
        <TabsContent value="write" forceMount className="editor-main">
          <section className="editor-title-panel">
            <Label>
              Document title
              <Input
                className="title-input"
                value={content.title}
                disabled={!locked}
                onChange={(e) => change({ title: e.target.value })}
                maxLength={200}
              />
            </Label>
            <Label>
              Short summary
              <Textarea
                value={content.summary}
                disabled={!locked}
                onChange={(e) => change({ summary: e.target.value })}
                maxLength={1200}
                placeholder="Explain what this document helps the reader do."
                rows={2}
              />
            </Label>
          </section>
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
          <Card asChild>
            <section className="panel attachment-editor">
              <h2>Reference attachments</h2>
              <p>
                Attach supporting PDF or Word documents. Uploaded files are preserved with each
                published version.
              </p>
              {content.attachments.map((file) => (
                <div className="attachment" key={file.id}>
                  <Paperclip size={18} />
                  <a href={`/api/docs/files/${file.id}`}>{file.name}</a>
                  <Button
                    variant="ghost"
                    className="icon-button"
                    aria-label={`Remove ${file.name}`}
                    disabled={!locked}
                    onClick={() =>
                      change({ attachments: content.attachments.filter((f) => f.id !== file.id) })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              <Label className="upload-area">
                <Paperclip size={21} />
                <strong>{uploading ? 'Uploading…' : 'Choose a PDF or Word document'}</strong>
                <span>PDF or DOCX · Up to 4 MB per file</span>
                <Input
                  type="file"
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
          </Card>
        </TabsContent>
        <TabsContent value="details" forceMount asChild>
          <Card asChild>
            <aside className="editor-details panel">
              <h2>Document details</h2>
              <Label>
                Reference number
                <Input
                  disabled={!locked}
                  value={content.reference}
                  onChange={(e) => change({ reference: e.target.value })}
                  maxLength={50}
                />
              </Label>
              <Label>
                Document type
                <Input value={content.type} readOnly />
              </Label>
              <Label>
                Document owner
                <NativeSelect
                  disabled={!locked}
                  value={content.ownerId}
                  onChange={(e) => change({ ownerId: e.target.value })}
                >
                  {w.members
                    .filter((m) => canWrite(m))
                    .map((m) => (
                      <NativeSelectOption value={m.id} key={m.id}>
                        {m.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Label>
              <Label>
                Next review date
                <Input
                  type="date"
                  disabled={!locked}
                  value={content.reviewDate}
                  onChange={(e) => change({ reviewDate: e.target.value })}
                />
              </Label>
              <fieldset disabled={!locked}>
                <legend>Facilities</legend>
                {w.facilities.map((f) => (
                  <Label className="checkbox-label" key={f.id}>
                    <Checkbox
                      checked={content.facilityIds.includes(f.id)}
                      onCheckedChange={(checked) =>
                        change({
                          facilityIds:
                            checked === true
                              ? [...content.facilityIds, f.id]
                              : content.facilityIds.filter((id) => id !== f.id),
                        })
                      }
                    />
                    {f.name}
                  </Label>
                ))}
              </fieldset>
              <fieldset disabled={!locked}>
                <legend>Teams</legend>
                {w.teams.map((t) => (
                  <Label className="checkbox-label" key={t.id}>
                    <Checkbox
                      checked={content.teamIds.includes(t.id)}
                      onCheckedChange={(checked) =>
                        change({
                          teamIds:
                            checked === true
                              ? [...content.teamIds, t.id]
                              : content.teamIds.filter((id) => id !== t.id),
                        })
                      }
                    />
                    {t.name}
                  </Label>
                ))}
              </fieldset>
              <fieldset className="related-document-picker" disabled={!locked}>
                <legend>Related documents</legend>
                <p>Select any published guidance that supports this document.</p>
                {w.documents
                  .filter((d) => d.currentVersionId && d.id !== initial.documentId)
                  .map((d) => (
                    <Label className="checkbox-label" key={d.id}>
                      <Checkbox
                        checked={content.relatedIds.includes(d.id)}
                        onCheckedChange={(event) =>
                          change({
                            relatedIds:
                              event === true
                                ? [...content.relatedIds, d.id]
                                : content.relatedIds.filter((id) => id !== d.id),
                          })
                        }
                      />
                      {d.content.title}
                    </Label>
                  ))}
              </fieldset>
              <div className="editor-help">
                <LockKeyhole size={18} />
                <p>
                  {locked
                    ? 'You have the editing session. Others can read while you work.'
                    : 'Editing is locked until your session connects.'}
                </p>
              </div>
            </aside>
          </Card>
        </TabsContent>
      </div>
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
        <DialogContent className="workflow-dialog" showCloseButton={!busy}>
          <Badge tone="green">Independent review</Badge>
          <DialogTitle>Send your draft for review</DialogTitle>
          <DialogDescription>
            The draft will be frozen until the reviewer approves it or requests changes.
          </DialogDescription>
          <Label>
            What changed?
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              placeholder="Give the reviewer and your team a clear summary."
              required
            />
          </Label>
          <Label>
            Approver
            <NativeSelect aria-label="Approver" value={approver} onChange={(e) => setApprover(e.target.value)} required>
              <NativeSelectOption value="">Select an independent approver</NativeSelectOption>
              {approvers.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          {!approvers.length && (
            <Message error="No independent approver is available. An administrator must assign an active approver who has not edited this revision." />
          )}
          <Message error={error} />
          <div className="form-actions">
            <Button
              variant="outline"
              data-dialog-close
              className="button secondary"
              disabled={busy}
              onClick={() => setDialog(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="default"
              className="button primary"
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
              <Send size={17} />
              {busy ? 'Submitting…' : 'Send for review'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
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
    <Card asChild>
      <section className="panel risk-editor">
        <div className="panel-heading">
          <div>
            <h2>Risk assessment</h2>
            <p>Identify hazards, document controls, and assign follow-up actions.</p>
          </div>
          <Button
            variant="outline"
            className="button secondary compact"
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
            <Plus size={16} />
            Add hazard
          </Button>
        </div>
        {!w.matrix.configured && (
          <Message error="The risk matrix must be configured in Administration before submission." />
        )}
        {!c.riskRows.length && (
          <p className="empty-inline">Add the first hazard to start your assessment.</p>
        )}
        {c.riskRows.map((r, index) => (
          <fieldset className="risk-edit-row" key={r.id} disabled={disabled}>
            <div className="risk-edit-heading">
              <strong>Hazard {index + 1}</strong>
              <Button
                variant="ghost"
                className="icon-button"
                type="button"
                aria-label={`Remove hazard ${index + 1}`}
                onClick={() => onChange(c.riskRows.filter((row) => row.id !== r.id))}
              >
                <Trash2 size={17} />
              </Button>
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
                      <Badge tone={band?.color || 'neutral'}>
                        {score} · {band?.label || 'Unclassified'}
                      </Badge>
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
    </Card>
  );
}
