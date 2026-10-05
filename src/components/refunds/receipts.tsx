"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Paperclip, Trash2 } from "lucide-react";
import { FileField } from "@/components/ui/file-field";
import { IconButton } from "@/components/ui/icon-button";
import { Notice } from "@/components/ui-kit/notice";
import type { Receipt, RefundResult } from "@/lib/refunds/types";

const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Receipts on a request: each file as a row that opens it, Remove beside it while the request
 *  is editable, and a picker that uploads as soon as a file is chosen. */
export function RefundReceipts({ id, version, attachments, editable }: { id: string; version: number; attachments: Receipt[]; editable: boolean }) {
  const router = useRouter(), [error, setError] = useState('');
  // Upload and remove keep separate pending states, so each shows its own progress.
  const [busy, setBusy] = useState<{ kind: 'upload' } | { kind: 'remove'; id: string } | null>(null), [picker, setPicker] = useState(0);
  const operation = useRef<{ key: string; operationId: string; attachmentId: string } | null>(null);
  const current = attachments.filter(file => !file.removedAt);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget, file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) { setError('Receipts must be no larger than 4 MB.'); return; }
      await change(file);
    } finally {
      // A fresh picker, so choosing the same file again after an error still uploads it.
      input.value = ''; setPicker(key => key + 1);
    }
  }
  async function change(file: File | null, removeId?: string) {
    const key = `${version}:${removeId || `${file?.name}:${file?.size}:${file?.lastModified}`}`;
    if (operation.current?.key !== key) operation.current = { key, operationId: crypto.randomUUID(), attachmentId: removeId || crypto.randomUUID() };
    const form = new FormData(); form.set('id', id); form.set('version', String(version)); form.set('operationId', operation.current.operationId); form.set('attachmentId', operation.current.attachmentId);
    if (!removeId && file) form.set('file', file);
    setBusy(removeId ? { kind: 'remove', id: removeId } : { kind: 'upload' }); setError('');
    try {
      const response = await fetch('/api/refunds/files', { method: 'POST', body: form });
      const result = await response.json() as RefundResult;
      if (!result.ok) { setError(result.error); return; }
      operation.current = null; router.refresh();
    } catch { setError('Could not confirm the receipt update. Try again; it will not be added twice.'); } finally { setBusy(null); }
  }
  return <section className="pc-panel" aria-labelledby="receipts-heading"><h2 id="receipts-heading" className="text-lg font-semibold">Receipts and supporting files</h2>
    {attachments.length ? <ul className="pc-rows">{attachments.map(file => <li key={file.id} className="pc-row refund-file">
      <a href={`/api/refunds/files/${file.id}`} className="refund-file-link">
        <span className="pc-tile-icon"><Paperclip aria-hidden="true" /></span>
        <span className="pc-row-body"><span className="pc-row-title break-all">{file.name}</span><span className="pc-row-hint">{file.removedAt ? 'Removed, kept in history' : fileSize(file.size)}</span></span>
        <ChevronRight aria-hidden="true" className="pc-row-chevron" />
      </a>
      {editable && !file.removedAt && <IconButton type="button" variant="ghost" label={`Remove ${file.name}`} disabled={busy !== null} aria-busy={busy?.kind === 'remove' && busy.id === file.id} onClick={() => void change(null, file.id)}><Trash2 aria-hidden="true" /></IconButton>}
    </li>)}</ul> : <p className="text-sm text-ui-muted-foreground">No receipts attached.</p>}
    {editable && current.length < 5 && <FileField key={picker} id="receipt-upload" label="Add a receipt" optional accept=".pdf,.jpg,.jpeg,.png,.webp" description="PDF, JPEG, PNG or WebP, up to 4 MB each and five per request. Avoid bank or card details." pending={busy?.kind === 'upload'} disabled={busy?.kind === 'remove'} onChange={event => void upload(event)} />}
    {error && <Notice tone="error" live="alert" title={error} />}
  </section>;
}
