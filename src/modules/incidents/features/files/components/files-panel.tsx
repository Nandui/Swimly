"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FileField } from "@/components/ui/file-field";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { formatDateTime } from "@/lib/format";
import { removeIncidentFile } from "@/modules/incidents/features/files/server/actions";

type FileRow = { id: string; name: string; mime: string; size: number; addedById: string; addedByName: string; createdAt: Date };

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Photos and documents on a report: the scene, the hazard, a doctor's note.
 *  Up to 10, each up to 4 MB. Closed reports keep theirs as they are. */
export function FilesPanel({ reportId, files, userId, canAdd, canRemoveAny }: { reportId: string; files: FileRow[]; userId: string; canAdd: boolean; canRemoveAny: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("reportId", reportId);
      form.set("file", file);
      try {
        const response = await fetch("/api/incidents/files", { method: "POST", body: form });
        const result = (await response.json()) as { ok: boolean; error?: string };
        if (!result.ok) { setError(result.error ?? "Could not add the file. Try again."); return; }
        toast.success("File added");
        router.refresh();
      } catch {
        setError("Could not add the file. Check the connection and try again.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const result = await removeIncidentFile(id);
      if (!result.ok) { setError(result.error); return; }
      toast.success("File removed");
      router.refresh();
    });
  }

  if (!files.length && !canAdd) return null;
  return (
    <section aria-labelledby="inc-files-h" className="pc-panel flex flex-col gap-4">
      <div className="space-y-1">
        <h2 id="inc-files-h">Photos and files</h2>
        <p className="text-sm text-ui-muted-foreground">Photos of the scene or the hazard, and documents such as a doctor&apos;s note. Avoid people&apos;s faces where you can.</p>
      </div>
      {canAdd ? (
        <FileField ref={input} id="inc-file" label="Add a photo or file" description="JPEG, PNG, WebP or PDF, up to 4 MB each, 10 at most" optional
          accept="image/jpeg,image/png,image/webp,application/pdf" pending={pending} pendingLabel="Adding…"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
      ) : null}
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      {files.length === 0 ? <p className="text-sm text-ui-muted-foreground">No photos or files yet.</p> : (
        <ul className="pc-rows">
          {files.map((f) => {
            const Icon = f.mime.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={f.id} className="pc-row">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-ui-muted-foreground" />
                <span className="pc-row-body">
                  <a href={`/api/incidents/files/${f.id}`} target="_blank" rel="noreferrer" className="pc-row-title underline-offset-4 hover:underline">{f.name}</a>
                  <span className="pc-row-hint tabular-nums">{kb(f.size)} · {f.addedByName} · {formatDateTime(f.createdAt)}</span>
                </span>
                {canAdd && (canRemoveAny || f.addedById === userId) ? (
                  <span className="pc-row-trail">
                    <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`}>
                      <Trash2 aria-hidden="true" />Remove
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
