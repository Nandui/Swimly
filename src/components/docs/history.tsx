'use client';
import { NativeSelectOption } from '@/components/shadcn/native-select';
import { Button } from '@/components/shadcn/button';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { diffWords } from 'diff';
import { History, RotateCcw, ChevronRight, GitCompareArrows } from 'lucide-react';
import { plainText } from '@/lib/docs/content';
import {
  DOC_STATUS_META,
  docEventLabel,
  documentTypeLabels,
  formatDate,
  canWrite,
  type Workspace,
  type Snapshot,
  type AuditEvent,
} from '@/lib/docs/types';
import { Tag } from '@/components/ui-kit/tag';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { startDraftAction } from '@/app/docs/actions';
import { DocumentBody, RiskAssessmentView } from './document-body';
import { FilterSelect } from './ui';
import { Notice } from '@/components/ui-kit/notice';
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
  const title = w.documents.find((document) => document.id === id)?.content.title;
  const currentId = w.documents.find((document) => document.id === id)?.currentVersionId;
  const name = (member: string | null) => w.members.find((m) => m.id === member)?.name;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        back={{ href: `/docs/documents/${id}`, label: 'Document' }}
        title="Version history"
        description="Every submission and publication, with the people and decisions behind it"
        actions={
          snapshots.length > 1 ? (
            <Button variant="outline" onClick={() => setCompare((v) => !v)}>
              <GitCompareArrows aria-hidden="true" />
              {compare ? 'Close comparison' : 'Compare versions'}
            </Button>
          ) : undefined
        }
      />
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="docs-split">
        <div className="flex min-w-0 flex-col gap-4">
          {compare && a && b && (
              <section className="pc-panel comparison" aria-labelledby="compare-heading">
                <h2 id="compare-heading">Compare versions</h2>
                <div className="flex flex-wrap gap-3">
                  <FilterSelect label="Earlier version" value={left} onChange={setLeft}>
                    {snapshots.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id} disabled={s.id === right}>
                        {label(s)}
                      </NativeSelectOption>
                    ))}
                  </FilterSelect>
                  <FilterSelect label="Later version" value={right} onChange={setRight}>
                    {snapshots.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id} disabled={s.id === left}>
                        {label(s)}
                      </NativeSelectOption>
                    ))}
                  </FilterSelect>
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
                      <p className="text-sm font-semibold text-ui-muted-foreground">{label(s)}</p>
                      <h2>{s.content.title}</h2>
                      <div className="compare-metadata">
                        <p>
                          Reference: {s.content.reference} · Type: {documentTypeLabels[s.content.type].long}
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
          )}
          <section className="pc-panel" aria-labelledby="versions-heading">
            <h2 id="versions-heading">{title || 'Versions'}</h2>
            {snapshots.length ? (
              <ul className="pc-rows">
                {snapshots.map((s) => (
                  <li className="pc-row" key={s.id}>
                    <div className="flex min-w-0 flex-1 basis-full flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="pc-tile-icon"><History aria-hidden="true" /></span>
                      <h3>{label(s)}</h3>
                      <Tag meta={DOC_STATUS_META[s.kind === 'publication' ? 'published' : 'submitted']} />
                      {currentId === s.id && <Tag meta={DOC_STATUS_META.current} />}
                    </div>
                    {s.changeSummary ? <p className="text-sm">{s.changeSummary}</p> : null}
                    <p className="pc-row-hint">
                      {formatDate(s.createdAt)} · {name(s.authorId)}
                      {s.approverId && ` · Approver: ${name(s.approverId)}`}
                      {s.contributors.length > 0 &&
                        ` · Contributors: ${s.contributors.map((c) => name(c) || c).join(', ')}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline">
                        <Link href={`/docs/documents/${id}?version=${s.id}`}>
                          View
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      </Button>
                      {canWrite(w.member) && s.kind === 'publication' && !archived && (
                        <Button
                          variant="ghost"
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
                          <RotateCcw aria-hidden="true" />
                          Restore as draft
                        </Button>
                      )}
                    </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                as="h3"
                icon="book"
                title="No versions yet"
                hint="Versions appear here once this draft is submitted for review or published"
              />
            )}
          </section>
        </div>
        {events.length > 0 && (
          <section className="pc-panel" aria-labelledby="activity-heading">
            <h2 id="activity-heading">Activity log</h2>
            <ul className="pc-feed">
              {events.map((event) => (
                <li key={event.id}>
                  <span className="pc-feed-dot" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-semibold">{docEventLabel(event.action)}</p>
                    {event.detail ? <p className="text-sm break-words">{event.detail}</p> : null}
                    <p className="pc-row-hint">
                      {name(event.actorId)} · {formatDate(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
