"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { formatDate } from "@/lib/format";
import { applyRosterImport, previewRosterImport, saveRotaDepartments, type RosterPreview } from "@/lib/rota/import";
import { toast } from "@/lib/toast";

type Site = { id: string; name: string };

/** Upload the week's roster: check it first (nothing is saved), say where any
 *  new department works, then import. The server reads the file again on
 *  import rather than trusting the preview. */
export function RosterImport({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [importing, startImport] = useTransition();

  const form = (f: File) => { const data = new FormData(); data.set("file", f); return data; };
  function check(f: File | null = file) {
    if (!f) { setError("Choose the roster file (.xlsx) first."); return; }
    setError(null);
    startCheck(async () => {
      const result = await previewRosterImport(form(f));
      if (result.ok) setPreview(result.preview); else { setPreview(null); setError(result.error); }
    });
  }
  function importWeek() {
    if (!file || !preview) return;
    startImport(async () => {
      const result = await applyRosterImport(form(file));
      if (!result.ok) { setError(result.error); return; }
      toast.success(`Roster for the week of ${formatDate(new Date(`${preview.weekStart}T00:00:00Z`))} imported`);
      router.push(`/rota?week=${preview.weekStart}`);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="module-panel flex flex-col gap-4" aria-labelledby="roster-file">
        <div className="flex flex-col gap-1">
          <h2 id="roster-file">The week&apos;s roster</h2>
          <p className="text-sm text-ui-muted-foreground">The Excel export from the payroll system (RosterBrowser), both sites in one file. Uploading a week again replaces it and records what changed; shifts added by hand stay.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="roster-upload">File</Label>
            <Input ref={input} id="roster-upload" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="min-h-11"
              onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(null); setError(null); if (f) check(f); }} />
          </div>
          <LoadingButton type="button" variant="outline" pending={checking} pendingLabel="Checking…" onClick={() => check()} className="min-h-11"><FileSpreadsheet aria-hidden="true" />Check file</LoadingButton>
        </div>
        {error ? <Notice tone="error" title={error} /> : null}
      </section>

      {preview ? <PreviewPanel preview={preview} sites={sites} onMapped={() => check()} importing={importing} onImport={importWeek} /> : null}
    </div>
  );
}

function PreviewPanel({ preview, sites, onMapped, importing, onImport }: { preview: RosterPreview; sites: Site[]; onMapped: () => void; importing: boolean; onImport: () => void }) {
  const week = formatDate(new Date(`${preview.weekStart}T00:00:00Z`));
  const blocked = preview.unmapped.length > 0;
  return (
    <section className="module-panel flex flex-col gap-5" aria-labelledby="roster-preview">
      <div className="flex flex-col gap-1">
        <h2 id="roster-preview">Week of {week}</h2>
        <p className="text-sm text-ui-muted-foreground">{preview.fileName}. Nothing is saved until you import.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="People" value={preview.people} hint={`${preview.newPeople} new · ${preview.linked} with a login`} />
        <Figure label="Shifts" value={preview.shifts} hint={preview.sites.map((s) => `${s.name} ${s.shifts}`).join(" · ") || "No site yet"} />
        <Figure label="Full holiday (paid)" value={preview.holidays} hint="Days off, paid" />
        <Figure label={preview.changes ? "Changes" : "First upload"} value={preview.changes ? preview.changes.added + preview.changes.removed + preview.changes.changed : "New"}
          hint={preview.changes ? `${preview.changes.added} added · ${preview.changes.changed} changed · ${preview.changes.removed} removed` : "Nothing to compare yet"} />
      </dl>

      {preview.problems.length ? (
        <Notice tone="warning" title={`${preview.problems.length} ${preview.problems.length === 1 ? "entry was" : "entries were"} left out`}
          description={<ul className="mt-1 list-disc pl-5">{preview.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>} />
      ) : null}

      {blocked ? (
        <div className="flex flex-col gap-3">
          <Notice tone="warning" title={`Where ${preview.unmapped.length === 1 ? "does this department" : "do these departments"} work?`}
            description="Each department code on the roster belongs to a site. Give it a site and a name the rota can show; this is asked once per code." />
          <DepartmentRows codes={preview.unmapped} sites={sites} submitLabel="Save and check again" onSaved={onMapped} />
        </div>
      ) : null}

      {preview.changes && preview.changes.sample.length ? (
        <div className="flex flex-col gap-2">
          <h3>What changes</h3>
          <ul className="divide-y divide-ui-border rounded-ui-lg border border-ui-border text-sm">
            {preview.changes.sample.map((c) => (
              <li key={`${c.employeeNo}:${c.date}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-ui-muted-foreground">{formatDate(new Date(`${c.date}T00:00:00Z`))}</span>
                <span className="text-ui-muted-foreground">{c.kind === "added" ? `Added ${c.after}` : c.kind === "removed" ? `Removed ${c.before}` : `${c.before} → ${c.after}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton type="button" pending={importing} pendingLabel="Importing…" disabled={blocked} onClick={onImport} className="min-h-11">
          <Upload aria-hidden="true" />{preview.changes ? "Replace the week" : "Import the week"}
        </LoadingButton>
        {blocked ? <p className="text-sm text-ui-muted-foreground">Say where each department works first.</p> : null}
      </div>
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-ui-lg border border-ui-border p-3">
      <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
      <dd className="text-xs text-ui-muted-foreground">{hint}</dd>
    </div>
  );
}

/** A site and a label for each department code; saved together. */
export function DepartmentRows({ codes, sites, initial = {}, submitLabel = "Save departments", onSaved }: {
  codes: string[];
  sites: Site[];
  initial?: Record<string, { siteId: string | null; label: string }>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() => codes.map((code) => ({ code, siteId: initial[code]?.siteId ?? (sites.length === 1 ? sites[0].id : ""), label: initial[code]?.label ?? "" })));
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  function save() {
    setError(null);
    start(async () => {
      const result = await saveRotaDepartments(rows);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Departments saved");
      if (onSaved) onSaved(); else router.refresh();
    });
  }
  if (!sites.length) return <Notice tone="warning" title="Your rota role does not cover a site, so departments can't be placed." />;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={row.code} className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums"><CalendarCheck aria-hidden="true" className="size-4 text-ui-primary" />{row.code}</span>
            <NativeSelect aria-label={`Site for department ${row.code}`} value={row.siteId} onChange={(e) => set(i, { siteId: e.target.value })} className="min-h-11 w-full">
              <NativeSelectOption value="">Choose a site</NativeSelectOption>
              {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
            <Input aria-label={`Name for department ${row.code}`} placeholder="Name, e.g. Lifeguards" maxLength={60} value={row.label} onChange={(e) => set(i, { label: e.target.value })} className="min-h-11" />
          </li>
        ))}
      </ul>
      {error ? <Notice tone="error" title={error} /> : null}
      <div><Button type="button" variant="outline" disabled={saving} onClick={save} className="min-h-11">{saving ? "Saving…" : submitLabel}</Button></div>
    </div>
  );
}
