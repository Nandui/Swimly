'use client';
import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Button } from '@/components/shadcn/button';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { diffWords } from 'diff';
import { ArrowLeft, History, RotateCcw, ArrowUpRight, GitCompareArrows } from 'lucide-react';
import { plainText } from '@/lib/docs/content';
import { formatDate, canWrite, type Workspace, type Snapshot, type AuditEvent } from '@/lib/docs/types';
import { startDraftAction } from '@/app/docs/actions';
import { DocumentBody, RiskAssessmentView } from './document-body';
import { PageHeading, Badge, Message } from './ui';
export function HistoryView({
  workspace: w,
  id,
  snapshots,
  events,
  archived,
}: {
  workspace: Workspace;
  id: string;
  snapshots: Snapshot[];
  events: AuditEvent[];
  archived: boolean;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(snapshots[1]?.id || snapshots[0]?.id || '');
  const [right, setRight] = useState(snapshots[0]?.id || '');
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const a = snapshots.find((s) => s.id === left);
  const b = snapshots.find((s) => s.id === right);
  const label = (s: Snapshot) =>
    s.kind === 'publication' ? `Version ${s.version}` : `Review · ${formatDate(s.createdAt)}`;
  return (
    <>
      <div className="breadcrumb">
        <Link href={`/docs/documents/${id}`}>
          <ArrowLeft size={15} />
          Document
        </Link>
        <span>/</span>
        <span>History</span>
      </div>
      <PageHeading
        eyebrow="A CLEAR RECORD OF CHANGE"
        title="Version history"
        description="Every submission and publication, with the people and decisions behind it."
        action={
          snapshots.length > 1 ? (
            <Button
              variant="outline"
              className="button secondary"
              onClick={() => setCompare((v) => !v)}
            >
              <GitCompareArrows size={17} />
              {compare ? 'Close comparison' : 'Compare versions'}
            </Button>
          ) : undefined
        }
      />
      <Message error={error} />
      <div className="history-workspace" data-comparing={compare}>
        <div className="history-revisions">
          {compare && a && b && (
            <Card asChild>
              <section className="panel comparison">
                <div className="comparison-selectors">
                  <Label>
                    Earlier version
                    <NativeSelect value={left} onChange={(e) => setLeft(e.target.value)}>
                      {snapshots.map((s) => (
                        <NativeSelectOption key={s.id} value={s.id} disabled={s.id === right}>
                          {label(s)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Label>
                  <Label>
                    Later version
                    <NativeSelect value={right} onChange={(e) => setRight(e.target.value)}>
                      {snapshots.map((s) => (
                        <NativeSelectOption key={s.id} value={s.id} disabled={s.id === left}>
                          {label(s)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Label>
                </div>
                <h3>Text changes</h3>
                <p className="diff-key">
                  <span>Added text is underlined.</span>
                  <span>Removed text is struck through.</span>
                </p>
                <div className="text-diff">
                  {diffWords(
                    `${a.content.title}\n${a.content.summary}\n${plainText(a.content.body)}`,
                    `${b.content.title}\n${b.content.summary}\n${plainText(b.content.body)}`,
                  ).map((part, i) =>
                    part.added ? (
                      <ins key={i}>{part.value}</ins>
                    ) : part.removed ? (
                      <del key={i}>{part.value}</del>
                    ) : (
                      <span key={i}>{part.value}</span>
                    ),
                  )}
                </div>
                <h3>Full documents, side by side</h3>
                <div className="side-by-side">
                  {[a, b].map((s, index) => (
                    <article key={`${s.id}-${index}`}>
                      <Badge>{label(s)}</Badge>
                      <h2>{s.content.title}</h2>
                      <div className="compare-metadata">
                        <p>
                          Reference: {s.content.reference} · Type: {s.content.type}
                        </p>
                        <p>
                          Owner: {w.members.find((m) => m.id === s.content.ownerId)?.name} · Review:{' '}
                          {formatDate(s.content.reviewDate)}
                        </p>
                        <p>
                          Facilities:{' '}
                          {s.content.facilityIds
                            .map((id) => w.facilities.find((f) => f.id === id)?.name)
                            .join(', ')}
                        </p>
                        <p>
                          Teams:{' '}
                          {s.content.teamIds
                            .map((id) => w.teams.find((t) => t.id === id)?.name)
                            .join(', ')}
                        </p>
                      </div>
                      <DocumentBody body={s.content.body} />
                      <RiskAssessmentView content={s.content} members={w.members} />
                      <h3>Attachments</h3>
                      {s.content.attachments.map((f) => (
                        <p key={f.id}>
                          <a href={`/api/docs/files/${f.id}`}>{f.name}</a>
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              </section>
            </Card>
          )}
          <Card asChild>
            <section className="panel history-list">
              {snapshots.map((s, index) => (
                <div className="history-row" key={s.id}>
                  <span className="history-marker">
                    <History size={18} />
                  </span>
                  <div className="history-description">
                    <div>
                      <h2>{label(s)}</h2>
                      <Badge tone={s.kind === 'publication' ? 'green' : 'amber'}>
                        {s.kind === 'publication' ? 'Published' : 'Submitted'}
                      </Badge>
                      {index === 0 && <span className="muted">Most recent record</span>}
                      {w.documents.find((document) => document.id === id)?.currentVersionId ===
                        s.id && <Badge tone="blue">Current approved version</Badge>}
                    </div>
                    <p>{s.changeSummary}</p>
                    <span>
                      {formatDate(s.createdAt)} · {w.members.find((m) => m.id === s.authorId)?.name}
                      {s.approverId &&
                        ` · Approver: ${w.members.find((m) => m.id === s.approverId)?.name}`}
                    </span>
                    <small>
                      Contributors:{' '}
                      {s.contributors
                        .map((id) => w.members.find((m) => m.id === id)?.name || id)
                        .join(', ')}
                    </small>
                  </div>
                  <div className="history-actions">
                    <Button asChild variant="outline">
                      <Link
                        className="button secondary compact"
                        href={`/docs/documents/${id}?version=${s.id}`}
                      >
                        View
                        <ArrowUpRight size={15} />
                      </Link>
                    </Button>
                    {canWrite(w.member) && s.kind === 'publication' && !archived && (
                      <Button
                        variant="ghost"
                        className="button ghost compact"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          const result = await startDraftAction(id, s.id);
                          if (result.ok) router.push(`/docs/documents/${id}/edit`);
                          else {
                            setError(result.error);
                            setBusy(false);
                          }
                        }}
                      >
                        <RotateCcw size={15} />
                        Restore as draft
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </Card>
        </div>
        {events.length > 0 && (
          <Card asChild>
            <section className="panel audit-panel">
              <h2>Activity log</h2>
              {events.map((event) => (
                <div className="audit-row" key={event.id}>
                  <span className="status-dot" />
                  <div>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <p>{event.detail}</p>
                    <small>
                      {w.members.find((m) => m.id === event.actorId)?.name} ·{' '}
                      {formatDate(event.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </section>
          </Card>
        )}
      </div>
    </>
  );
}
