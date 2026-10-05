'use client';
import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Textarea } from '@/components/shadcn/textarea';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Pencil, Save, Mail, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import {
  saveMemberAction,
  saveGroupAction,
  saveMatrixAction,
  saveTemplateAction,
} from '@/app/docs/actions';
import {
  type Workspace,
  type WorkspaceMember,
  type RiskMatrix,
  type AuditEvent,
  type Template,
  formatDate,
  docEventLabel,
  documentTypeLabels,
  riskBandMeta,
  RISK_BAND_TONE_META,
  DOC_STATUS_META,
} from '@/lib/docs/types';
import { RichEditor } from './rich-editor';
import { Avatar, FilterSelect } from './ui';
import { Notice } from '@/components/ui-kit/notice';
import { Tag } from '@/components/ui-kit/tag';
import { PageHeader } from '@/components/ui-kit/page-header';
import { SegmentedLinks } from '@/components/ui-kit/segmented-links';
import { SearchField } from '@/components/ui-kit/search-field';
import { EmptyState } from '@/components/ui-kit/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { FormDialog } from '@/components/form-dialog';
export type MailItem = {
  id: string;
  recipient: string;
  subject: string;
  link: string;
  createdAt: string;
};
export function AdminView({
  workspace: w,
  mail,
  events,
}: {
  workspace: Workspace;
  mail: MailItem[];
  events: AuditEvent[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const sections = [
    'people',
    'facility',
    'team',
    'templates',
    'matrix',
    'activity',
    ...(w.localMode ? ['mail'] : []),
  ];
  const tab = sections.includes(params.get('section') || '') ? params.get('section')! : 'people';
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatus, setStaffStatus] = useState('');
  const visibleStaff = w.members.filter(
    (member) =>
      `${member.name} ${member.email}`.toLowerCase().includes(staffSearch.toLowerCase()) &&
      (!staffStatus || (staffStatus === 'active' ? member.active : !member.active)),
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, start] = useTransition();
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>();
  // A section change clears its messages and any group being renamed, so a group id never
  // carries from Facilities into Teams (the sections are plain links, so this view stays mounted).
  const [shownTab, setShownTab] = useState(tab);
  if (shownTab !== tab) {
    setShownTab(tab);
    setError('');
    setSuccess('');
    setGroupName('');
    setGroupId(undefined);
  }
  const [template, setTemplate] = useState<Template>(w.templates[0]);
  const [matrix, setMatrix] = useState<RiskMatrix>(
    w.matrix.likelihood.length === 5
      ? w.matrix
      : {
          configured: false,
          likelihood: Array.from({ length: 5 }, (_, i) => ({
            label: `Level ${i + 1}`,
            description: '',
          })),
          severity: Array.from({ length: 5 }, (_, i) => ({
            label: `Level ${i + 1}`,
            description: '',
          })),
          bands: [
            { label: 'Low', min: 1, max: 4, color: 'green' },
            { label: 'Moderate', min: 5, max: 9, color: 'amber' },
            { label: 'High', min: 10, max: 16, color: 'orange' },
            { label: 'Very high', min: 17, max: 25, color: 'red' },
          ],
        },
  );
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setError('');
    setSuccess('');
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error || 'Could not save that. Try again.');
      else {
        setSuccess(message);
        setGroupName('');
        setGroupId(undefined);
        router.refresh();
      }
    });
  }
  return (
    <>
      <PageHeader
        title="Administration"
        description="Manage document groups, templates and standards. Staff accounts and permissions are shared with Turnfin"
      />
      <div className="flex min-w-0 flex-col gap-4">
        <SegmentedLinks
          label="Administration sections"
          items={[
            ['people', 'People'],
            ['facility', 'Facilities'],
            ['team', 'Teams'],
            ['templates', 'Templates'],
            ['matrix', 'Risk matrix'],
            ['activity', 'Activity'],
            ...(w.localMode ? [['mail', 'Local mailbox']] : []),
          ].map(([key, label]) => ({ href: `/docs/admin?section=${key}`, label, current: tab === key }))}
        />
        <div className="flex min-w-0 flex-col gap-4">
          {error ? <Notice tone="error" live="alert" title={error} /> : success ? <Notice tone="success" live="status" title={success} /> : null}
          {tab === 'people' && (
            <section className="pc-panel" aria-labelledby="staff-heading">
              <div className="pc-panel-head">
                <div>
                  <h2 id="staff-heading">Staff directory</h2>
                  <p className="text-sm text-ui-muted-foreground">Everyone has their own account and a clear role</p>
                </div>
                <Tag meta={DOC_STATUS_META.active} label={`${w.members.filter((m) => m.active).length} active staff`} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <SearchField
                  label="Search staff"
                  placeholder="Name or email"
                  value={staffSearch}
                  onValueChange={setStaffSearch}
                  className="min-w-0 flex-1 basis-64"
                />
                <FilterSelect label="Show" value={staffStatus} onChange={setStaffStatus}>
                  <NativeSelectOption value="">All staff</NativeSelectOption>
                  <NativeSelectOption value="active">Active</NativeSelectOption>
                  <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
                </FilterSelect>
              </div>
              <p role="status" className="text-xs text-ui-muted-foreground">
                {visibleStaff.length} staff {visibleStaff.length === 1 ? 'member' : 'members'}
              </p>
              {visibleStaff.length ? (
                <ul className="pc-rows">
                  {visibleStaff.map((m) => {
                    const teams = m.teamIds.map((id) => w.teams.find((t) => t.id === id)?.name).filter(Boolean).join(', ');
                    const places = m.facilityIds.map((id) => w.facilities.find((f) => f.id === id)?.name).filter(Boolean).join(', ');
                    return (
                      <li className="pc-row" key={m.id}>
                        <Avatar size="lg" member={m} />
                        <span className="pc-row-body">
                          <span className="pc-row-title">{m.name}</span>
                          <span className="pc-row-hint">{m.email}</span>
                          <span className="pc-row-hint">
                            {`Teams: ${teams || 'none'} · Facilities: ${places || 'all'}`}
                            {!m.access.read ? ' · No Docs access: grant it in Turnfin Roles' : ''}
                          </span>
                        </span>
                        <span className="pc-row-trail">
                          {m.role ? <Tag meta={DOC_STATUS_META.role} label={m.role} /> : null}
                          <Tag meta={DOC_STATUS_META[m.active ? 'active' : 'inactive']} />
                          <MemberGroupsDialog workspace={w} member={m} onSaved={() => router.refresh()} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  as="h3"
                  icon="users"
                  title="No staff match"
                  hint="Try another name, or change the Show filter"
                />
              )}
            </section>
          )}
          {(tab === 'facility' || tab === 'team') && (
            <div className="docs-split">
              <section className="pc-panel" aria-labelledby="groups-heading">
                <div>
                  <h2 id="groups-heading">{tab === 'facility' ? 'Facilities' : 'Teams'}</h2>
                  <p className="text-sm text-ui-muted-foreground">
                    {tab === 'facility'
                      ? 'Organise guidance around the places your staff work.'
                      : 'Group staff to make required reading easier to assign.'}{' '}
                    Sites and departments come from Staff, under Organisation, and so does who
                    belongs to them.
                  </p>
                </div>
                <ul className="pc-rows">
                  {(tab === 'facility' ? w.facilities : w.teams).map((g) => {
                    const count = w.members.filter((m) =>
                      (tab === 'facility' ? m.facilityIds : m.teamIds).includes(g.id),
                    ).length;
                    return (
                      <li className="pc-row" key={g.id}>
                        <span className="pc-row-body">
                          <span className="pc-row-title">{g.name}</span>
                          <span className="pc-row-hint">
                            {count} {count === 1 ? 'staff member' : 'staff members'}
                            {g.source === 'platform' ? ' · managed in Staff' : ' · Docs-only group'}
                          </span>
                        </span>
                        {g.source !== 'platform' && (
                          <IconButton
                            label={`Rename ${g.name}`}
                            onClick={() => {
                              setGroupName(g.name);
                              setGroupId(g.id);
                            }}
                          >
                            <Pencil aria-hidden="true" />
                          </IconButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <form
                className="pc-panel"
                aria-labelledby="group-form-heading"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () => saveGroupAction(tab, groupName, groupId),
                    groupId ? 'Name updated.' : 'Created successfully.',
                  );
                }}
              >
                <h2 id="group-form-heading">{groupId ? 'Rename' : tab === 'facility' ? 'Add a facility' : 'Add a team'}</h2>
                <div className="flex flex-col gap-2">
                  <Label className="block" htmlFor="docs-group-name">Name</Label>
                  <Input
                    id="docs-group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <Button disabled={pending} className="self-start">
                  {groupId ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {groupId ? 'Save name' : tab === 'facility' ? 'Add facility' : 'Add team'}
                </Button>
              </form>
            </div>
          )}
          {tab === 'templates' && template && (
            <Card asChild>
              <section className="pc-panel" aria-labelledby="templates-heading">
                <div>
                  <h2 id="templates-heading">Document templates</h2>
                  <p className="text-sm text-ui-muted-foreground">
                    Template changes apply to new documents. Existing documents keep their content.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <FilterSelect
                    label="Template"
                    value={template.id}
                    onChange={(value) =>
                      setTemplate(structuredClone(w.templates.find((t) => t.id === value)!))
                    }
                  >
                    {w.templates.map((t) => (
                      <NativeSelectOption key={t.id} value={t.id}>
                        {documentTypeLabels[t.type].long}
                      </NativeSelectOption>
                    ))}
                  </FilterSelect>
                  <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                    <Label className="block" htmlFor="docs-template-name">Template name</Label>
                    <Input
                      id="docs-template-name"
                      value={template.name}
                      onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
                    />
                  </div>
                </div>
                <RichEditor
                  key={template.id}
                  value={template.body}
                  onChange={(body) => setTemplate((t) => ({ ...t, body }))}
                />
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => saveTemplateAction(template.id, template.name, template.body),
                        'Template saved for future documents.',
                      )
                    }
                  >
                    <Save aria-hidden="true" />
                    Save template
                  </Button>
                </div>
              </section>
            </Card>
          )}
          {tab === 'matrix' && (
            <Card asChild>
              <section className="pc-panel matrix-admin" aria-labelledby="matrix-heading">
                <div className="pc-panel-head">
                  <div>
                    <h2 id="matrix-heading">Risk scoring matrix</h2>
                    <p className="text-sm text-ui-muted-foreground">
                      Set your organisation’s 5×5 definitions and bands. Published assessments
                      keep their original matrix.
                    </p>
                  </div>
                  <Tag meta={DOC_STATUS_META[w.matrix.configured ? 'configured' : 'setupRequired']} />
                </div>
                {w.localMode && (
                  <Notice
                    tone="warning"
                    title="The local sample matrix is illustrative. Set and review your own definitions before operational use."
                  />
                )}
                <div className="matrix-edit-grid">
                  {(['likelihood', 'severity'] as const).map((axis) => (
                    <div key={axis}>
                      <h3>{axis === 'likelihood' ? 'Likelihood' : 'Severity'}</h3>
                      {matrix[axis].map((entry, i) => (
                        <div className="matrix-level" key={i}>
                          <span className="pc-tile-icon font-semibold" aria-hidden="true">{i + 1}</span>
                          <div>
                            <Label>
                              <span className="sr-only">
                                {axis} {i + 1} label
                              </span>
                              <Input
                                value={entry.label}
                                maxLength={80}
                                onChange={(e) =>
                                  setMatrix((m) => ({
                                    ...m,
                                    [axis]: m[axis].map((v, index) =>
                                      index === i ? { ...v, label: e.target.value } : v,
                                    ),
                                  }))
                                }
                              />
                            </Label>
                            <Label>
                              <span className="sr-only">
                                {axis} {i + 1} definition
                              </span>
                              <Textarea
                                value={entry.description}
                                maxLength={500}
                                placeholder="Describe what this level means in your organisation."
                                onChange={(e) =>
                                  setMatrix((m) => ({
                                    ...m,
                                    [axis]: m[axis].map((v, index) =>
                                      index === i ? { ...v, description: e.target.value } : v,
                                    ),
                                  }))
                                }
                              />
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div>
                  <h3>Score bands</h3>
                  <p className="text-sm text-ui-muted-foreground">
                    Cover every score from 1 to 25 exactly once, with no gaps or overlapping ranges.
                  </p>
                </div>
                <div className="risk-band-row risk-band-header" aria-hidden="true">
                  <span>Label</span>
                  <span>From</span>
                  <span>To</span>
                  <span>Risk level</span>
                  <span />
                </div>
                <ul className="pc-rows">
                  {matrix.bands.map((band, i) => (
                    <li className="risk-band-row" key={i}>
                      <Label>
                        <span className="risk-band-label">Label<span className="sr-only"> of band {i + 1}</span></span>
                        <Input
                          value={band.label}
                          onChange={(e) =>
                            setMatrix((m) => ({
                              ...m,
                              bands: m.bands.map((b, j) =>
                                j === i ? { ...b, label: e.target.value } : b,
                              ),
                            }))
                          }
                        />
                      </Label>
                      <Label>
                        <span className="risk-band-label">From<span className="sr-only"> (band {i + 1})</span></span>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          value={band.min}
                          onChange={(e) =>
                            setMatrix((m) => ({
                              ...m,
                              bands: m.bands.map((b, j) =>
                                j === i ? { ...b, min: Number(e.target.value) } : b,
                              ),
                            }))
                          }
                        />
                      </Label>
                      <Label>
                        <span className="risk-band-label">To<span className="sr-only"> (band {i + 1})</span></span>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          value={band.max}
                          onChange={(e) =>
                            setMatrix((m) => ({
                              ...m,
                              bands: m.bands.map((b, j) =>
                                j === i ? { ...b, max: Number(e.target.value) } : b,
                              ),
                            }))
                          }
                        />
                      </Label>
                      <Label>
                        <span className="risk-band-label">Risk level<span className="sr-only"> of band {i + 1}</span></span>
                        <NativeSelect
                          value={band.color}
                          onChange={(e) =>
                            setMatrix((m) => ({
                              ...m,
                              bands: m.bands.map((b, j) =>
                                j === i ? { ...b, color: e.target.value } : b,
                              ),
                            }))
                          }
                        >
                          {Object.entries(RISK_BAND_TONE_META).map(([value, meta]) => (
                            <NativeSelectOption key={value} value={value}>
                              {meta.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Label>
                      <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <Tag meta={riskBandMeta(band)} />
                        <IconButton
                          label={`Remove band ${i + 1}`}
                          disabled={matrix.bands.length === 1}
                          onClick={() =>
                            setMatrix((m) => ({ ...m, bands: m.bands.filter((_, j) => j !== i) }))
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </IconButton>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={matrix.bands.length >= 8}
                    onClick={() =>
                      setMatrix((m) => ({
                        ...m,
                        bands: [...m.bands, { label: 'New band', min: 1, max: 1, color: 'amber' }],
                      }))
                    }
                  >
                    <Plus aria-hidden="true" />
                    Add band
                  </Button>
                  <Button
                    variant="default"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => saveMatrixAction({ ...matrix, configured: true }),
                        'Risk matrix saved. Existing versions are unchanged.',
                      )
                    }
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Confirm and save matrix
                  </Button>
                </div>
              </section>
            </Card>
          )}
          {tab === 'activity' && (
            <section className="pc-panel" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Workspace activity</h2>
              {events.length ? (
                <ul className="pc-feed">
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className="pc-feed-dot" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold">{docEventLabel(e.action)}</p>
                        {e.detail ? <p className="text-sm break-words">{e.detail}</p> : null}
                        <p className="pc-row-hint">
                          {w.members.find((m) => m.id === e.actorId)?.name} · {formatDate(e.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState as="h3" icon="book" title="No activity yet" hint="Changes to documents, groups and settings appear here" />
              )}
            </section>
          )}
          {tab === 'mail' && (
            <section className="pc-panel" aria-labelledby="mail-heading">
              <div>
                <h2 id="mail-heading">Local invitation and reset mailbox</h2>
                <p className="text-sm text-ui-muted-foreground">
                  Development delivery only. These links are visible to administrators; no email is sent.
                </p>
              </div>
              {mail.length ? (
                <ul className="pc-rows">
                  {mail.map((item) => (
                    <li className="pc-row" key={item.id}>
                      <span className="pc-tile-icon"><Mail aria-hidden="true" /></span>
                      <span className="pc-row-body">
                        <span className="pc-row-title">{item.subject}</span>
                        <span className="pc-row-hint">{item.recipient} · {formatDate(item.createdAt)}</span>
                      </span>
                      <Button asChild variant="outline">
                        <a href={item.link}>
                          Open account link
                          <ChevronRight aria-hidden="true" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState as="h3" icon="book" title="No messages yet" hint="Invitations and password resets appear here" />
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** One person's Docs-only groups, edited in the shared FormDialog from the row's pencil.
 *  Sites and departments come from Staff: they show checked and locked, marked "from Staff",
 *  and the server ignores them if sent. */
function MemberGroupsDialog({
  workspace: w,
  member,
  onSaved,
}: {
  workspace: Workspace;
  member: WorkspaceMember;
  onSaved: () => void;
}) {
  const choices = (legend: string, name: string, groups: Workspace['facilities'], chosen: string[]) => (
    <fieldset className="editor-choices">
      <legend>{legend}</legend>
      {groups.length ? (
        groups.map((g) => (
          <Label className="flex min-h-11 flex-row items-center gap-3 font-normal" key={g.id}>
            <Checkbox
              name={name}
              value={g.id}
              disabled={g.source === 'platform'}
              defaultChecked={chosen.includes(g.id)}
            />
            <span>
              {g.name}
              {g.source === 'platform' ? <span className="block text-xs text-ui-muted-foreground">From Staff</span> : null}
            </span>
          </Label>
        ))
      ) : (
        <p className="text-sm text-ui-muted-foreground">None yet</p>
      )}
    </fieldset>
  );
  return (
    <FormDialog
      trigger={
        <IconButton label={`Edit document groups for ${member.name}`} disabled={!member.access.read}>
          <Pencil aria-hidden="true" />
        </IconButton>
      }
      title="Document groups"
      description={`${member.name}${member.email ? ` · ${member.email}` : ''}. Sites and departments follow their Staff profile; add Docs-only groups here.`}
      submitLabel="Save document groups"
      successMessage="Document groups updated"
      portalClassName="turnfin-docs"
      submit={async (form) => {
        const result = await saveMemberAction({
          id: member.id,
          facilityIds: form.getAll('facilityIds').map(String),
          teamIds: form.getAll('teamIds').map(String),
        });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      }}
      onSuccess={onSaved}
    >
      {choices('Facilities', 'facilityIds', w.facilities, member.facilityIds)}
      {choices('Teams', 'teamIds', w.teams, member.teamIds)}
    </FormDialog>
  );
}
