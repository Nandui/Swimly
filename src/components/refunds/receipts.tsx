"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { RefundInput } from "@/components/refunds/fields";
import type { Receipt, RefundResult } from "@/lib/refunds/types";

export function RefundReceipts({ id, version, attachments, editable }: { id: string; version: number; attachments: Receipt[]; editable: boolean }) {
  const router = useRouter(), [pending, setPending] = useState(false), [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), operation = useRef<{ key: string; operationId: string; attachmentId: string } | null>(null);
  const current = attachments.filter(file => !file.removedAt);
  async function change(removeId?: string) {
    const file = fileInput.current?.files?.[0];
    if (!removeId && !file) { setError('Choose a receipt to upload.'); return; }
    if (file && !removeId && file.size > 4 * 1024 * 1024) { setError('Receipts must be no larger than 4 MB.'); return; }
    const key = `${version}:${removeId || `${file?.name}:${file?.size}:${file?.lastModified}`}`;
    if (operation.current?.key !== key) operation.current = { key, operationId: crypto.randomUUID(), attachmentId: removeId || crypto.randomUUID() };
    const form = new FormData(); form.set('id', id); form.set('version', String(version)); form.set('operationId', operation.current.operationId); form.set('attachmentId', operation.current.attachmentId);
    if (!removeId && file) form.set('file', file);
    setPending(true); setError('');
    try {
      const response = await fetch('/api/refunds/files', { method: 'POST', body: form });
      const result = await response.json() as RefundResult;
      if (!result.ok) { setError(result.error); return; }
      operation.current = null; if (fileInput.current) fileInput.current.value = ''; router.refresh();
    } catch { setError('Could not confirm the receipt update. Try again; it will not be added twice.'); } finally { setPending(false); }
  }
  return <section className="space-y-4" aria-labelledby="receipts-heading"><h2 id="receipts-heading" className="text-lg font-semibold">Receipts and supporting files</h2>
    {attachments.length ? <ul className="divide-y divide-ui-border">{attachments.map(file => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Button asChild variant="link" className="h-auto min-h-11 min-w-0 justify-start whitespace-normal px-0 text-left"><a href={`/api/refunds/files/${file.id}`} className="break-all">{file.name}{file.removedAt ? ' (removed; kept in history)' : ''}</a></Button>{editable && !file.removedAt && <Button type="button" disabled={pending} variant="ghost" className="min-h-11" onClick={() => void change(file.id)} aria-label={`Remove ${file.name}`}>Remove</Button>}</li>)}</ul> : <p className="text-sm text-ui-muted-foreground">No receipts attached.</p>}
    {editable && current.length < 5 && <form onSubmit={event => { event.preventDefault(); void change(); }} className="space-y-3"><RefundInput ref={fileInput} id="receipt-upload" label="Add a receipt (optional)" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={pending} hint="PDF, JPEG, PNG or WebP. Up to 4 MB each, five receipts per request. Avoid bank or card details." /><Button disabled={pending} type="submit" variant="outline" className="min-h-11">{pending ? 'Updating receipt…' : 'Upload receipt'}</Button></form>}
    {error && <Notice tone="error" title={error} />}
  </section>;
}
