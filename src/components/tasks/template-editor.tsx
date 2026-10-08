"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { saveTaskTemplate, type TemplateInput } from "@/lib/tasks/actions";
import {
  FIELD_TYPES, FIELD_TYPE_LABELS, LOG_MODES, LOG_MODE_LABELS, REPEATS, SCHEDULED_KINDS, TEMPLATE_KINDS, TEMPLATE_KIND_LABELS, scheduleLabel,
  type FieldType, type LogMode, type Repeat, type TaskField, type TaskSchedule, type TemplateKind,
} from "@/lib/tasks/rules";
import { toast } from "@/lib/toast";

type Option = { id: string; name: string };
export type EditableTemplate = Omit<TemplateInput, "fields" | "schedules"> & { id: string | null; version: number | null; status: "draft" | "published" | "archived"; fields: TaskField[]; schedules: TaskSchedule[] };

const TABS = ["content", "schedule", "assign", "report"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { content: "Content", schedule: "Schedule", assign: "Assign", report: "Report" };
const REPEAT_LABELS: Record<Repeat, string> = { once: "Once", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const UNIT: Record<Repeat, string> = { once: "", daily: "days", weekly: "weeks", monthly: "months" };
const WEEKDAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]] as const;
const KIND_HINTS: Record<TemplateKind, string> = {
  repeat: "Its schedules make its tasks at its sites.",
  once: "Its schedule makes its task once, on that day.",
  adhoc: "Staff add it from Today when it is needed, open from the site's opening to its closing.",
  action: "Offered when someone raises a follow-up action: it adds this task to record the work.",
  automated: "Made by another module when something happens. No module sends these yet, so it makes no tasks for now.",
};
const key = () => crypto.randomUUID().slice(0, 8);
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** A schedule time: a clock time, or the site's opening or closing. */
function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const mode = value === "open" || value === "close" ? value : "at";
  return (
    <div className="flex flex-col gap-2">
      <Select id={`${id}-mode`} label={label} value={mode} onValueChange={(m) => onChange(m === "at" ? "08:00" : m)}
        options={[{ value: "at", label: "At a time" }, { value: "open", label: "When the site opens" }, { value: "close", label: "When the site closes" }]} />
      {mode === "at" ? <Input id={id} label={`${label}: time`} type="time" value={value} onChange={onChange} /> : null}
    </div>
  );
}

/** Write a task template (owner request, 8 October 2026; the prototype's task designer): Content
 *  (what it asks: instructions, checklist, record log, sign-off), Schedule (how it is made and
 *  when), Assign (sites, roles, tags, priority) and Report (notifications). Drafts make no tasks;
 *  publishing checks it and its schedules start from today. Tasks already made keep what they asked. */
export function TemplateEditor({ template, sites, roles, today }: { template: EditableTemplate; sites: Option[]; roles: Option[]; today: string }) {
  const router = useRouter();
  const [t, setT] = useState(template);
  const [tags, setTags] = useState(template.tags?.join(", ") ?? "");
  const [tab, setTab] = useState<Tab>("content");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"save" | "publish" | null>(null);
  const initial = useMemo(() => JSON.stringify({ ...template, tags: template.tags?.join(", ") ?? "" }), [template]);
  const dirty = JSON.stringify({ ...t, tags }) !== initial;
  const set = <K extends keyof EditableTemplate>(k: K, v: EditableTemplate[K]) => setT((x) => ({ ...x, [k]: v }));
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  const fields = t.fields, schedules = t.schedules, checklist = t.checklist ?? [];
  const setField = (i: number, patch: Partial<TaskField>) => set("fields", fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const setSchedule = (i: number, patch: Partial<TaskSchedule>) => set("schedules", schedules.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = <T,>(list: T[], i: number, by: number) => { const next = [...list]; const [x] = next.splice(i, 1); next.splice(i + by, 0, x); return next; };
  const published = t.status === "published";
  const scheduled = SCHEDULED_KINDS.includes(t.kind);

  // Leaving with unsaved changes asks first (from the prototype).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save(publish: boolean) {
    setError(null);
    setDoing(publish ? "publish" : "save");
    start(async () => {
      const input: TemplateInput = {
        title: t.title, description: t.description ?? "", kind: t.kind, siteIds: t.siteIds, roleIds: t.roleIds, restricted: t.restricted, priority: t.priority, checklist,
        tags: tags.split(",").map((x) => x.trim()).filter(Boolean), fields, minimumRecords: t.minimumRecords, logMode: t.logMode, schedules,
        requiresComment: t.requiresComment, requiresApproval: t.requiresApproval, notifyCompletion: t.notifyCompletion, notifyException: t.notifyException,
      };
      const r = await saveTaskTemplate(t.id, t.version, input, publish || published);
      setDoing(null);
      if (!r.ok) { setError(r.error); return; }
      toast.success(publish ? "Published" : published ? "Changes saved" : "Draft saved");
      if (!t.id && r.id) router.push(`/tasks/templates/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <SegmentedChoice aria-label="Template sections" value={tab} onValueChange={(v) => setTab(v as Tab)}
        options={TABS.map((x) => ({ value: x, label: TAB_LABELS[x] }))} fill="phone" />

      {tab === "content" ? (
        <>
          <section className="pc-panel" aria-labelledby="tpl-about">
            <div className="pc-panel-head"><h2 id="tpl-about">What it is</h2></div>
            <Input id="tpl-title" label="Task title" required maxLength={120} value={t.title} onChange={(v) => set("title", v)} placeholder="For example: Pool water quality" />
            <Textarea id="tpl-description" label="Instructions" optional description="Shown at the top of the task." maxLength={2000} rows={3} value={t.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </section>

          <section className="pc-panel" aria-labelledby="tpl-checklist">
            <div className="pc-panel-head">
              <div className="flex flex-col gap-1"><h2 id="tpl-checklist">Checklist</h2><p className="pc-row-hint">Each item is ticked before the task can be completed.</p></div>
              <Button type="button" variant="outline" onClick={() => set("checklist", [...checklist, ""])}><Plus aria-hidden="true" />Add an item</Button>
            </div>
            {checklist.length === 0 ? <p className="text-sm text-ui-muted-foreground">No checklist.</p> : (
              <ol className="flex flex-col gap-2">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-end gap-2">
                    <Input id={`tpl-check-${i}`} label={`Item ${i + 1}`} className="grow" maxLength={300} value={item} onChange={(v) => set("checklist", checklist.map((x, j) => (j === i ? v : x)))} />
                    <Button type="button" variant="outline" size="icon" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => set("checklist", move(checklist, i, -1))}><ArrowUp aria-hidden="true" /></Button>
                    <Button type="button" variant="outline" size="icon" aria-label={`Move item ${i + 1} down`} disabled={i === checklist.length - 1} onClick={() => set("checklist", move(checklist, i, 1))}><ArrowDown aria-hidden="true" /></Button>
                    <Button type="button" variant="outline" size="icon" aria-label={`Remove item ${i + 1}`} onClick={() => set("checklist", checklist.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="pc-panel" aria-labelledby="tpl-fields">
            <div className="pc-panel-head">
              <div className="flex flex-col gap-1"><h2 id="tpl-fields">Record log</h2><p className="pc-row-hint">Readings and answers recorded with the task. A number can have an acceptable range: a reading outside it is flagged.</p></div>
              <Button type="button" variant="outline" onClick={() => set("fields", [...fields, { id: key(), label: "", type: "text", required: true }])}><Plus aria-hidden="true" />Add a field</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select id="tpl-logmode" label="Records" value={t.logMode} onValueChange={(v) => set("logMode", v as LogMode)}
                options={LOG_MODES.map((m) => ({ value: m, label: LOG_MODE_LABELS[m] }))} />
              {t.logMode === "table" ? (
                <Input id="tpl-records" label="Records needed" description="The least someone records, such as one reading per pool." type="number" min={1} max={50}
                  value={String(t.minimumRecords)} onChange={(v) => set("minimumRecords", Math.max(1, Math.floor(Number(v) || 1)))} />
              ) : null}
            </div>
            {fields.length === 0 ? <p className="text-sm text-ui-muted-foreground">No fields.</p> : fields.map((f, i) => (
              <fieldset key={f.id} className="flex flex-col gap-4 rounded-[var(--pc-radius-card)] border border-[var(--pc-line)] p-4">
                <legend className="px-1 font-semibold">Field {i + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input id={`tpl-f-label-${f.id}`} label={f.type === "heading" ? "Section heading" : "Label"} maxLength={200} value={f.label} onChange={(v) => setField(i, { label: v })} />
                  <Select id={`tpl-f-type-${f.id}`} label="Field type" value={f.type} onValueChange={(v) => setField(i, { type: v as FieldType })} options={FIELD_TYPES.map((x) => ({ value: x, label: FIELD_TYPE_LABELS[x] }))} />
                </div>
                {f.type === "choice" ? (
                  <Textarea id={`tpl-f-options-${f.id}`} label="Options" description="One per line." rows={3} value={(f.options ?? []).join("\n")}
                    onChange={(e) => setField(i, { options: e.target.value.split("\n").map((x) => x.trimStart()).slice(0, 30) })} />
                ) : null}
                {f.type === "number" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input id={`tpl-f-min-${f.id}`} label="Minimum" optional type="number" step="any" defaultValue={f.min ?? ""} onChange={(v) => setField(i, { min: num(v) })} />
                    <Input id={`tpl-f-max-${f.id}`} label="Maximum" optional type="number" step="any" defaultValue={f.max ?? ""} onChange={(v) => setField(i, { max: num(v) })} />
                    <Input id={`tpl-f-unit-${f.id}`} label="Unit" optional maxLength={20} value={f.unit ?? ""} onChange={(v) => setField(i, { unit: v })} placeholder="mg/L" />
                    <Input id={`tpl-f-warn-${f.id}`} label="Out-of-range guidance" optional className="sm:col-span-3" maxLength={300} value={f.warning ?? ""} onChange={(v) => setField(i, { warning: v })} placeholder="For example: check dosing and retest." />
                    <Switch id={`tpl-f-action-${f.id}`} className="sm:col-span-3" label="Require a follow-up action outside this range" description="The task cannot be completed until one is raised." checked={!!f.needsAction} onCheckedChange={(v) => setField(i, { needsAction: v })} />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {f.type !== "heading" ? <Switch id={`tpl-f-req-${f.id}`} label="Required answer" checked={f.required} onCheckedChange={(v) => setField(i, { required: v })} /> : <span />}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={`Move field ${i + 1} up`} disabled={i === 0} onClick={() => set("fields", move(fields, i, -1))}><ArrowUp aria-hidden="true" /></Button>
                    <Button type="button" variant="outline" size="icon" aria-label={`Move field ${i + 1} down`} disabled={i === fields.length - 1} onClick={() => set("fields", move(fields, i, 1))}><ArrowDown aria-hidden="true" /></Button>
                    <Button type="button" variant="outline" size="icon" aria-label={`Remove field ${i + 1}`} onClick={() => set("fields", fields.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
                  </div>
                </div>
              </fieldset>
            ))}
          </section>

          <section className="pc-panel" aria-labelledby="tpl-signoff">
            <div className="pc-panel-head"><h2 id="tpl-signoff">Sign-off</h2></div>
            <Switch id="tpl-comment" label="Require a comment to complete" description="Someone writes a note before completing it." checked={t.requiresComment} onCheckedChange={(v) => set("requiresComment", v)} />
            <Switch id="tpl-approval" label="Require approval after completion" description="A reviewer checks it after it is done; nobody approves their own." checked={t.requiresApproval} onCheckedChange={(v) => set("requiresApproval", v)} />
          </section>
        </>
      ) : null}

      {tab === "schedule" ? (
        <section className="pc-panel" aria-labelledby="tpl-when">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="tpl-when">How is this task added?</h2><p className="pc-row-hint">{KIND_HINTS[t.kind]}</p></div>
          </div>
          <Select id="tpl-kind" label="Kind" value={t.kind} onValueChange={(v) => set("kind", v as TemplateKind)} options={TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND_LABELS[k] }))} />
          {scheduled ? (
            <>
              <p className="text-sm text-ui-muted-foreground">Times are each site&apos;s clock. A due time at or before the start is the next morning. Closed dates are skipped; each site&apos;s hours set its opening and closing (Sites).</p>
              {schedules.length === 0 ? <p className="text-sm text-ui-muted-foreground">No schedule yet.</p> : schedules.map((s, i) => (
                <fieldset key={s.id} className="flex flex-col gap-4 rounded-[var(--pc-radius-card)] border border-[var(--pc-line)] p-4">
                  <legend className="px-1 font-semibold">{scheduleLabel(t.kind === "once" ? { ...s, repeat: "once" } : s)}</legend>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {t.kind === "repeat" ? <Select id={`tpl-repeat-${s.id}`} label="Repeats" value={s.repeat} onValueChange={(v) => setSchedule(i, { repeat: v as Repeat })} options={REPEATS.map((r) => ({ value: r, label: REPEAT_LABELS[r] }))} /> : null}
                    {t.kind === "repeat" && s.repeat !== "once" ? <Input id={`tpl-every-${s.id}`} label={`Repeat every how many ${UNIT[s.repeat]}`} type="number" min={1} max={52} value={String(s.every)} onChange={(v) => setSchedule(i, { every: Math.max(1, Math.floor(Number(v) || 1)) })} /> : null}
                    <Input id={`tpl-from-${s.id}`} label={t.kind === "once" || s.repeat === "once" ? "On" : "First date"} description={t.kind === "repeat" && s.repeat === "monthly" ? "It repeats on this day of the month." : undefined} type="date" value={s.from} onChange={(v) => setSchedule(i, { from: v })} />
                    <TimeField id={`tpl-start-${s.id}`} label="Available from" value={s.start} onChange={(v) => setSchedule(i, { start: v })} />
                    <TimeField id={`tpl-due-${s.id}`} label="Due by" value={s.due} onChange={(v) => setSchedule(i, { due: v })} />
                  </div>
                  {t.kind === "repeat" && s.repeat === "weekly" ? (
                    <fieldset className="flex flex-col gap-2">
                      <legend className="mb-2 text-sm font-semibold">On</legend>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map(([d, label]) => (
                          <Label key={d} htmlFor={`tpl-day-${s.id}-${d}`} className="flex min-h-11 items-center gap-2 rounded-[var(--pc-radius-control)] border border-[var(--pc-line)] px-4 font-normal">
                            <Checkbox id={`tpl-day-${s.id}-${d}`} checked={s.weekdays.includes(d)} onCheckedChange={(v) => setSchedule(i, { weekdays: v === true ? [...s.weekdays, d] : s.weekdays.filter((x) => x !== d) })} />{label}
                          </Label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <div><Button type="button" variant="ghost" onClick={() => set("schedules", schedules.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" />Remove schedule {i + 1}</Button></div>
                </fieldset>
              ))}
              <div><Button type="button" variant="outline" onClick={() => set("schedules", [...schedules, { id: key(), repeat: t.kind === "once" ? "once" : "daily", every: 1, weekdays: [1, 2, 3, 4, 5], from: today, start: "open", due: "close" }])}><Plus aria-hidden="true" />Add a schedule</Button></div>
            </>
          ) : <Notice tone="info" title={TEMPLATE_KIND_LABELS[t.kind]} description={KIND_HINTS[t.kind]} />}
        </section>
      ) : null}

      {tab === "assign" ? (
        <>
          <div className="pc-grid">
            <section className="pc-panel" aria-labelledby="tpl-sites">
              <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="tpl-sites">Sites</h2><p className="pc-row-hint">None ticked means every site.</p></div></div>
              <div className="flex flex-col gap-2">
                {sites.map((s) => <ChoiceRow key={s.id} type="checkbox" id={`tpl-site-${s.id}`} title={s.name} checked={t.siteIds.includes(s.id)} onCheckedChange={(v) => set("siteIds", toggle(t.siteIds, s.id, v === true))} />)}
              </div>
            </section>
            <section className="pc-panel" aria-labelledby="tpl-roles">
              <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="tpl-roles">Roles</h2><p className="pc-row-hint">Who it is for. None ticked means everyone who does tasks at the site.</p></div></div>
              <Switch id="tpl-restricted" label="Restrict completion to these roles" description="Reviewers can always step in." checked={t.restricted} onCheckedChange={(v) => set("restricted", v)} />
              <div className="flex flex-col gap-2">
                {roles.map((r) => <ChoiceRow key={r.id} type="checkbox" id={`tpl-role-${r.id}`} title={r.name} checked={t.roleIds.includes(r.id)} onCheckedChange={(v) => set("roleIds", toggle(t.roleIds, r.id, v === true))} />)}
              </div>
            </section>
          </div>
          <section className="pc-panel" aria-labelledby="tpl-tags">
            <div className="pc-panel-head"><h2 id="tpl-tags">Tags and priority</h2></div>
            <Input id="tpl-tags-input" label="Tags" optional description="Separate tags with commas, for example: Pool, Safety." maxLength={400} value={tags} onChange={setTags} />
            <Switch id="tpl-priority" label="High priority" description="Shown with a flag, so it is not missed." checked={t.priority} onCheckedChange={(v) => set("priority", v)} />
            <p className="text-sm text-ui-muted-foreground">Tasks already made keep their original definition. Changes apply to tasks made from now on.</p>
          </section>
        </>
      ) : null}

      {tab === "report" ? (
        <section className="pc-panel" aria-labelledby="tpl-report">
          <div className="pc-panel-head"><h2 id="tpl-report">Notifications</h2></div>
          <Switch id="tpl-notify-done" label="Notify on completion" description="Reviewers at the site see today's completions on their home page." checked={t.notifyCompletion} onCheckedChange={(v) => set("notifyCompletion", v)} />
          <Switch id="tpl-notify-exc" label="Notify when completed with readings out of range" description="Reviewers at the site see these on their home page." checked={t.notifyException} onCheckedChange={(v) => set("notifyException", v)} />
          <h3 className="font-semibold">Reporting</h3>
          <p className="text-sm text-ui-muted-foreground">Completions, flags, comments, readings out of range and approvals appear in Reports. Every saved change appears in Activity.</p>
        </section>
      ) : null}

      {error ? <Notice tone="error" live="alert" title="It isn’t saved yet" description={error} /> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty ? <span className="text-sm text-ui-muted-foreground" role="status">Not saved yet</span> : null}
        {published ? (
          <LoadingButton type="submit" pending={pending && doing === "save"} pendingLabel="Saving…" disabled={pending}><Save aria-hidden="true" />Save changes</LoadingButton>
        ) : (
          <>
            <LoadingButton type="submit" variant="outline" pending={pending && doing === "save"} pendingLabel="Saving…" disabled={pending}><Save aria-hidden="true" />Save draft</LoadingButton>
            <LoadingButton type="button" pending={pending && doing === "publish"} pendingLabel="Publishing…" disabled={pending} onClick={() => save(true)}><Send aria-hidden="true" />Publish task</LoadingButton>
          </>
        )}
      </div>
    </form>
  );
}
