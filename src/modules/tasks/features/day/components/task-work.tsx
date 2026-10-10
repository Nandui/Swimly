"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { ChoiceRow } from "@/components/ui/choice-row";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { completeTask, saveTaskProgress, uploadTaskFile } from "@/modules/tasks/features/day/server/actions";
import { exceptions, type TaskDefinition, type TaskField, type TaskRecord } from "@/modules/tasks/shared/rules";
import { toast } from "@/components/ui/toast";

type FileRef = { id: string; fileName: string };

/** The task itself: tick the checklist, answer its questions (one record, or several for a log),
 *  attach photos, then save progress or complete it. A reading outside its range shows at once;
 *  completing checks everything on the server again. Read only once it is closed or not theirs. */
export function TaskWork({ id, version, definition: def, checks: initialChecks, records: initialRecords, files: initialFiles, editable }: {
  id: string;
  version: number;
  definition: TaskDefinition;
  checks: boolean[];
  records: TaskRecord[];
  files: FileRef[];
  editable: boolean;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(() => def.checklist.map((_, i) => initialChecks[i] === true));
  // A log starts with as many records as it needs.
  const [records, setRecords] = useState<TaskRecord[]>(() => {
    const rows = initialRecords.length ? initialRecords : [{}];
    const need = editable && def.logMode === "table" ? Math.max(def.minimumRecords, 1) : 1;
    return rows.length >= need ? rows : [...rows, ...Array.from({ length: need - rows.length }, () => ({}))];
  });
  const [files, setFiles] = useState<FileRef[]>(initialFiles);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"save" | "complete" | null>(null);
  const asks = def.fields.some((f) => f.type !== "heading");
  // "Multiple records" (or a task from before the choice that asked for several) is a log.
  const log = asks && (def.logMode === "table" || def.minimumRecords > 1 || records.length > 1);
  const warnings = exceptions(def, records);
  const asked = def.fields.filter((f) => f.type !== "heading");

  // Leaving with unsaved changes asks first (from the prototype).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const answer = (i: number, field: string, value: string) => {
    setRecords((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  function run(kind: "save" | "complete") {
    setError(null);
    setDoing(kind);
    start(async () => {
      const input = { checks, records };
      const r = kind === "complete" ? await completeTask(id, version, input) : await saveTaskProgress(id, version, input);
      setDoing(null);
      if (!r.ok) { setError(r.error); return; }
      toast.success(kind === "complete" ? "Task completed" : "Progress saved");
      setDirty(false);
      router.refresh();
    });
  }

  async function upload(i: number, field: TaskField, file: File | undefined) {
    if (!file) return;
    setError(null);
    const key = `${i}:${field.id}`;
    setUploading(key);
    const form = new FormData();
    form.set("file", file);
    const r = await uploadTaskFile(id, form);
    setUploading(null);
    if (!r.ok || !r.fileId) { setError(r.ok ? "The file did not upload." : r.error); return; }
    setFiles((list) => [...list, { id: r.fileId!, fileName: r.fileName ?? file.name }]);
    answer(i, field.id, r.fileId);
  }

  const fileName = (fileId: string) => files.find((f) => f.id === fileId)?.fileName ?? "Attached file";

  return (
    <div className="flex flex-col gap-4">
      {def.checklist.length ? (
        <section className="pc-panel" aria-labelledby="task-checklist">
          <div className="pc-panel-head">
            <h2 id="task-checklist">Checklist <span className="text-ui-muted-foreground tabular-nums">· {checks.filter(Boolean).length} of {checks.length}</span></h2>
          </div>
          <div className="flex flex-col gap-2">
            {def.checklist.map((item, i) => (
              <ChoiceRow key={i} type="checkbox" id={`check-${i}`} title={item} checked={checks[i]} disabled={!editable}
                onCheckedChange={(v) => { setChecks((c) => c.map((x, j) => (j === i ? v === true : x))); setDirty(true); }} />
            ))}
          </div>
        </section>
      ) : null}

      {asks ? (
        <section className="pc-panel" aria-labelledby="task-records">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1">
              <h2 id="task-records">{log ? "Records" : "Answers"}{log ? <span className="text-ui-muted-foreground tabular-nums"> · {records.length}</span> : null}</h2>
              {def.minimumRecords > 1 ? <p className="pc-row-hint">At least {def.minimumRecords} records.</p> : null}
            </div>
          </div>
          {!editable && log ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">Record</TableHead>
                {asked.map((f) => <TableHead key={f.id} scope="col">{f.label}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {records.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">{i + 1}</TableCell>
                    {asked.map((f) => {
                      const value = row[f.id] ?? "";
                      return <TableCell key={f.id} className="whitespace-normal [overflow-wrap:anywhere]">{!value ? "Not answered" : f.type === "file"
                        ? <a className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4" href={`/tasks/files/${value}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" className="size-4" />{fileName(value)}</a>
                        : `${value}${f.type === "number" && f.unit ? ` ${f.unit}` : ""}`}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : records.map((row, i) => (
            <fieldset key={i} className="flex flex-col gap-4 rounded-[var(--pc-radius-card)] border border-[var(--pc-line)] p-4">
              {log ? (
                <legend className="flex w-full items-center justify-between gap-2 px-1">
                  <span className="font-semibold">Record {i + 1}</span>
                </legend>
              ) : <legend className="sr-only">Answers</legend>}
              {def.fields.map((f) => {
                const key = `${i}-${f.id}`;
                const value = row[f.id] ?? "";
                if (f.type === "heading") return <h3 key={key} className="font-semibold">{f.label}</h3>;
                const range = f.type === "number" && (f.min != null || f.max != null)
                  ? `Acceptable: ${f.min != null && f.max != null ? `${f.min} to ${f.max}` : f.min != null ? `at least ${f.min}` : `at most ${f.max}`}${f.unit ? ` ${f.unit}` : ""}.`
                  : f.unit || undefined;
                if (!editable) {
                  return (
                    <div key={key} className="min-w-0">
                      <p className="text-xs font-semibold text-ui-muted-foreground">{f.label}</p>
                      <p className="mt-1 [overflow-wrap:anywhere]">
                        {!value ? "Not answered" : f.type === "file"
                          ? <a className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4" href={`/tasks/files/${value}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" className="size-4" />{fileName(value)}</a>
                          : `${value}${f.type === "number" && f.unit ? ` ${f.unit}` : ""}`}
                      </p>
                    </div>
                  );
                }
                if (f.type === "choice") {
                  return <Select key={key} id={`f-${key}`} label={f.label} optional={!f.required} value={value} onValueChange={(v) => answer(i, f.id, v)}
                    placeholder="Choose an answer" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />;
                }
                if (f.type === "text") {
                  return <Textarea key={key} id={`f-${key}`} label={f.label} optional={!f.required} value={value} rows={2} maxLength={4000} onChange={(e) => answer(i, f.id, e.target.value)} />;
                }
                if (f.type === "file") {
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <FileField id={`f-${key}`} label={f.label} optional={!f.required} description="A photo (PNG or JPEG) or a PDF, up to 5 MB." accept="image/png,image/jpeg,application/pdf"
                        pending={uploading === `${i}:${f.id}`} onChange={(e) => void upload(i, f, e.currentTarget.files?.[0])} />
                      {value ? <a className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" href={`/tasks/files/${value}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" className="size-4" />{fileName(value)}</a> : null}
                    </div>
                  );
                }
                return <Input key={key} id={`f-${key}`} label={f.label} optional={!f.required} description={range} value={value}
                  type={f.type === "number" ? "number" : "date"} step={f.type === "number" ? "any" : undefined} inputMode={f.type === "number" ? "decimal" : undefined}
                  className="max-w-56" onChange={(v) => answer(i, f.id, v)} />;
              })}
              {log && editable && records.length > Math.max(1, def.minimumRecords) ? (
                <div><Button type="button" variant="ghost" onClick={() => { setRecords((rows) => rows.filter((_, j) => j !== i)); setDirty(true); }}>
                  <Trash2 aria-hidden="true" />Remove record {i + 1}</Button></div>
              ) : null}
            </fieldset>
          ))}
          {editable && log ? (
            <div><Button type="button" variant="outline" onClick={() => { setRecords((rows) => [...rows, {}]); setDirty(true); }}><Plus aria-hidden="true" />Add a record</Button></div>
          ) : null}
        </section>
      ) : null}

      {warnings.length ? (
        <Notice tone="warning" title={warnings.length === 1 ? "A reading is out of range" : `${warnings.length} readings are out of range`}
          description={<ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
      ) : null}

      {editable ? (
        <div className="flex flex-col gap-3">
          {error ? <Notice tone="error" live="alert" title="It isn’t saved yet" description={error} /> : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty ? <span className="text-sm text-ui-muted-foreground" role="status">Not saved yet</span> : null}
            <LoadingButton type="button" variant="outline" pending={pending && doing === "save"} pendingLabel="Saving…" disabled={pending} onClick={() => run("save")}><Save aria-hidden="true" />Save progress</LoadingButton>
            <LoadingButton type="button" pending={pending && doing === "complete"} pendingLabel="Completing…" disabled={pending} onClick={() => run("complete")}><Check aria-hidden="true" />Complete task</LoadingButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
