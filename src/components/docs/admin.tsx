'use client';
import { Alert } from '@/components/shadcn/alert';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/docs/primitives/dialog';

import { Card } from '@/components/shadcn/card';
import { Label } from '@/components/shadcn/label';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/shadcn/table';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Textarea } from '@/components/shadcn/textarea';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {  Plus, Pencil, Save, Mail, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import {
  saveMemberAction,
  saveGroupAction,
  saveMatrixAction,
  saveTemplateAction,
} from '@/app/docs/actions';
import {
  type Workspace,
  type Member,
  type RiskMatrix,
  type AuditEvent,
  type Template,
  formatDate,
  canRead,
} from '@/lib/docs/types';
import { RichEditor } from './rich-editor';
import { PageHeading, Avatar, Badge, Message } from './ui';
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
  const setTab = (value: string) => router.push(`/docs/admin?section=${value}`, { scroll: false });
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
  const [editing, setEditing] = useState<Member | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>();
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
      if (!result.ok) setError(result.error || 'Please try again.');
      else {
        setSuccess(message);
        setEditing(null);
        setGroupName('');
        setGroupId(undefined);
        router.refresh();
      }
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="Your organisation"
        title="Administration"
        description="Manage document groups, templates and standards. Staff accounts and permissions are shared with Turnfin."

      />
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Administration sections">
          {[
            ['people', 'People'],
            ['facility', 'Facilities'],
            ['team', 'Teams'],
            ['templates', 'Templates'],
            ['matrix', 'Risk matrix'],
            ['activity', 'Activity'],
            ...(w.localMode ? [['mail', 'Local mailbox']] : []),
          ].map(([key, label]) => (
            <Button
              variant="ghost"
              key={key}
              className={tab === key ? 'selected' : ''}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key);
                setError('');
                setSuccess('');
                setGroupName('');
                setGroupId(undefined);
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div className="settings-content">
          <Message error={error} success={success} />
          {tab === 'people' && (
            <Card asChild>
              <section className="panel staff-directory">
                <div className="panel-heading">
                  <div>
                    <h2>Staff directory</h2>
                    <p>Everyone has their own account and a clear role.</p>
                  </div>
                  <Badge>{w.members.filter((m) => m.active).length} active staff</Badge>
                </div>
                <div className="staff-directory-filters">
                  <Label>
                    <span className="sr-only">Find staff</span>
                    <Input
                      type="search"
                      placeholder="Search name or email…"
                      value={staffSearch}
                      onChange={(event) => setStaffSearch(event.target.value)}
                    />
                  </Label>
                  <Label>
                    <span className="sr-only">Staff status</span>
                    <NativeSelect
                      value={staffStatus}
                      onChange={(event) => setStaffStatus(event.target.value)}
                    >
                      <NativeSelectOption value="">All staff</NativeSelectOption>
                      <NativeSelectOption value="active">Active</NativeSelectOption>
                      <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
                    </NativeSelect>
                  </Label>
                  <span role="status">
                    {visibleStaff.length} staff {visibleStaff.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="table-scroll">
                  <Table className="data-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Teams</TableHead>
                        <TableHead>Facilities</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleStaff.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <span className="staff-cell">
                              <Avatar member={m} />
                              <span>
                                <strong>{m.name}</strong>
                                <small>{m.email}</small>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge>{m.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {m.teamIds
                              .map((id) => w.teams.find((t) => t.id === id)?.name)
                              .join(', ') || '—'}
                          </TableCell>
                          <TableCell>
                            {m.facilityIds
                              .map((id) => w.facilities.find((t) => t.id === id)?.name)
                              .join(', ') || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge tone={m.active ? 'green' : 'neutral'}>
                              {m.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              className="icon-button"
                              aria-label={`Edit ${m.name}`}
                              disabled={!canRead(m)}
                              title={!canRead(m) ? 'Grant Docs access in Turnfin Roles first.' : 'Edit document groups'}
                              onClick={() => {
                                setError('');
                                setEditing(structuredClone(m));
                              }}
                            >
                              <Pencil size={17} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="staff-mobile-list">
                  {visibleStaff.map((member) => (
                    <li key={member.id}>
                      <div className="staff-mobile-heading">
                        <Avatar small member={member} />
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                      </div>
                      <div className="staff-mobile-badges">
                        <Badge>{member.role}</Badge>
                        <Badge tone={member.active ? 'green' : 'neutral'}>
                          {member.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p>
                        {member.facilityIds
                          .map((id) => w.facilities.find((facility) => facility.id === id)?.name)
                          .join(' · ') || 'No facilities assigned'}
                      </p>
                      <p>
                        Teams:{' '}
                        {member.teamIds
                          .map((id) => w.teams.find((team) => team.id === id)?.name)
                          .join(', ') || 'None assigned'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setError('');
                          setEditing(structuredClone(member));
                        }}
                        aria-label={`Edit ${member.name}`}
                        disabled={!canRead(member)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                        Edit document groups
                      </Button>
                    </li>
                  ))}
                </ul>
                {!visibleStaff.length && (
                  <p className="empty-inline">
                    No staff match this search. Try another name or change the status filter.
                  </p>
                )}
              </section>
            </Card>
          )}
          {(tab === 'facility' || tab === 'team') && (
            <div className="admin-split">
              <Card asChild>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{tab === 'facility' ? 'Facilities' : 'Teams'}</h2>
                      <p>
                        {tab === 'facility'
                          ? 'Organise guidance around the places your staff work.'
                          : 'Group staff to make required reading easier to assign.'}
                      </p>
                    </div>
                  </div>
                  {(tab === 'facility' ? w.facilities : w.teams).map((g) => (
                    <div className="group-row" key={g.id}>
                      <div>
                        <strong>{g.name}</strong>
                        <small>
                          {
                            w.members.filter((m) =>
                              (tab === 'facility' ? m.facilityIds : m.teamIds).includes(g.id),
                            ).length
                          }{' '}
                          staff members
                        </small>
                      </div>
                      <Button
                        variant="ghost"
                        className="icon-button"
                        aria-label={`Rename ${g.name}`}
                        onClick={() => {
                          setGroupName(g.name);
                          setGroupId(g.id);
                        }}
                      >
                        <Pencil size={17} />
                      </Button>
                    </div>
                  ))}
                </section>
              </Card>
              <Card asChild>
                <form
                  className="panel admin-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      () => saveGroupAction(tab, groupName, groupId),
                      groupId ? 'Name updated.' : 'Created successfully.',
                    );
                  }}
                >
                  <h2>{groupId ? 'Rename' : `Add a ${tab}`}</h2>
                  <Label>
                    Name
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </Label>
                  <Button variant="default" className="button primary" disabled={pending}>
                    <Plus size={16} />
                    {groupId ? 'Save name' : 'Add ' + tab}
                  </Button>
                </form>
              </Card>
            </div>
          )}
          {tab === 'templates' && template && (
            <Card asChild>
              <section className="panel template-admin">
                <div className="panel-heading">
                  <div>
                    <h2>Document templates</h2>
                    <p>
                      Template changes apply to new documents. Existing documents keep their
                      content.
                    </p>
                  </div>
                  <NativeSelect
                    aria-label="Select template"
                    value={template.id}
                    onChange={(e) =>
                      setTemplate(
                        structuredClone(w.templates.find((t) => t.id === e.target.value)!),
                      )
                    }
                  >
                    {w.templates.map((t) => (
                      <NativeSelectOption key={t.id} value={t.id}>
                        {t.type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <Label className="template-name">
                  Template name
                  <Input
                    value={template.name}
                    onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
                  />
                </Label>
                <RichEditor
                  key={template.id}
                  value={template.body}
                  onChange={(body) => setTemplate((t) => ({ ...t, body }))}
                />
                <div className="form-actions padded">
                  <Button
                    variant="default"
                    className="button primary"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => saveTemplateAction(template.id, template.name, template.body),
                        'Template saved for future documents.',
                      )
                    }
                  >
                    <Save size={16} />
                    Save template
                  </Button>
                </div>
              </section>
            </Card>
          )}
          {tab === 'matrix' && (
            <Card asChild>
              <section className="panel matrix-admin">
                <div className="panel-heading">
                  <div>
                    <h2>Risk scoring matrix</h2>
                    <p>
                      Set your organisation’s 5×5 definitions and bands. Published assessments
                      retain their original matrix.
                    </p>
                  </div>
                  <Badge tone={w.matrix.configured ? 'green' : 'amber'}>
                    {w.matrix.configured ? 'Configured' : 'Setup required'}
                  </Badge>
                </div>
                {w.localMode && (
                  <Alert role="status" className="notice warning">
                    The local sample matrix is illustrative. Set and review your own definitions
                    before operational use.
                  </Alert>
                )}
                <div className="matrix-edit-grid">
                  {(['likelihood', 'severity'] as const).map((axis) => (
                    <div key={axis}>
                      <h3>{axis === 'likelihood' ? 'Likelihood' : 'Severity'}</h3>
                      {matrix[axis].map((entry, i) => (
                        <div className="matrix-level" key={i}>
                          <strong>{i + 1}</strong>
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
                <h3>Score bands</h3>
                <p className="muted">
                  Cover every score from 1 to 25 exactly once, with no gaps or overlapping ranges.
                </p>
                <div className="band-editor">
                  {matrix.bands.map((band, i) => (
                    <div className="band-row" key={i}>
                      <Label>
                        Label
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
                        From
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
                        To
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
                        Colour
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
                          {['green', 'amber', 'orange', 'red'].map((v) => (
                            <NativeSelectOption key={v} value={v}>
                              {v}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Label>
                      <Button
                        variant="ghost"
                        className="button ghost compact"
                        disabled={matrix.bands.length === 1}
                        onClick={() =>
                          setMatrix((m) => ({ ...m, bands: m.bands.filter((_, j) => j !== i) }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  <Button
                    variant="outline"
                    className="button secondary"
                    disabled={matrix.bands.length >= 8}
                    onClick={() =>
                      setMatrix((m) => ({
                        ...m,
                        bands: [...m.bands, { label: 'New band', min: 1, max: 1, color: 'amber' }],
                      }))
                    }
                  >
                    Add band
                  </Button>
                  <Button
                    variant="default"
                    className="button primary"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => saveMatrixAction({ ...matrix, configured: true }),
                        'Risk matrix saved. Existing versions are unchanged.',
                      )
                    }
                  >
                    <CheckCircle2 size={17} />
                    Confirm and save matrix
                  </Button>
                </div>
              </section>
            </Card>
          )}
          {tab === 'activity' && (
            <Card asChild>
              <section className="panel audit-panel">
                <h2>Workspace activity</h2>
                {events.map((e) => (
                  <div key={e.id} className="audit-row">
                    <span className="status-dot" />
                    <div>
                      <strong>{e.action.replaceAll('_', ' ')}</strong>
                      <p>{e.detail}</p>
                      <small>
                        {w.members.find((m) => m.id === e.actorId)?.name} ·{' '}
                        {formatDate(e.createdAt)}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
            </Card>
          )}
          {tab === 'mail' && (
            <Card asChild>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Local invitation and reset mailbox</h2>
                    <p>
                      Development delivery only. These links are visible to administrators; no email
                      is sent.
                    </p>
                  </div>
                  <Mail size={22} />
                </div>
                {mail.length ? (
                  mail.map((item) => (
                    <div className="mail-row" key={item.id}>
                      <div>
                        <strong>{item.subject}</strong>
                        <p>
                          {item.recipient} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <Button asChild variant="outline">
                        <a className="button secondary compact" href={item.link}>
                          Open account link
                          <ArrowUpRight size={16} />
                        </a>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="empty-inline">Invitations and password resets will appear here.</p>
                )}
              </section>
            </Card>
          )}
        </div>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setEditing(null);
          }
        }}
      >
        <DialogContent className="workflow-dialog" showCloseButton={!pending}>
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) run(() => saveMemberAction(editing), 'Document groups updated.');
            }}
          >
            <DialogTitle>Document groups</DialogTitle>
            <DialogDescription>Accounts and permissions are managed in Turnfin Staff and Roles. These groups control document assignments.</DialogDescription>
            <p>{editing?.name} · {editing?.email}</p>
            {editing && (
              <>
                <fieldset>
                  <legend>Facilities</legend>
                  {w.facilities.map((g) => (
                    <Label className="checkbox-label" key={g.id}>
                      <Checkbox
                        checked={editing.facilityIds.includes(g.id)}
                        onCheckedChange={(checked) =>
                          setEditing({
                            ...editing,
                            facilityIds:
                              checked === true
                                ? [...editing.facilityIds, g.id]
                                : editing.facilityIds.filter((id) => id !== g.id),
                          })
                        }
                      />
                      {g.name}
                    </Label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Teams</legend>
                  {w.teams.map((g) => (
                    <Label className="checkbox-label" key={g.id}>
                      <Checkbox
                        checked={editing.teamIds.includes(g.id)}
                        onCheckedChange={(checked) =>
                          setEditing({
                            ...editing,
                            teamIds:
                              checked === true
                                ? [...editing.teamIds, g.id]
                                : editing.teamIds.filter((id) => id !== g.id),
                          })
                        }
                      />
                      {g.name}
                    </Label>
                  ))}
                </fieldset>

              </>
            )}
            <Message error={error} />
            <div className="form-actions">
              <Button
                variant="outline"
                data-dialog-close
                className="button secondary"
                type="button"
                onClick={() => {
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="default" className="button primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save document groups'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
