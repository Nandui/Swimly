"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { acceptFor, sizeLimit } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { removeMaintenancePhoto } from "@/modules/maintenance/features/photos/server/actions";
import { uploadPhoto } from "@/modules/maintenance/shared/upload";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, type MaintenancePhotoView } from "@/modules/maintenance/shared/types";

/** A request's photos as tiles that open full size, with Add and Remove while it is open for
 *  whoever reported it or a manager at the site. */
export function PhotoStrip({ requestId, photos, canAdd, canRemove }: { requestId: string; photos: MaintenancePhotoView[]; canAdd: boolean; canRemove: boolean }) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      const result = await uploadPhoto(requestId, file);
      if (picker.current) picker.current.value = "";
      if (!result.ok) { setError(result.error); return; }
      toast.success("Photo added");
      router.refresh();
    });
  }
  function remove(id: string) {
    setError(null);
    start(async () => {
      const result = await removeMaintenancePhoto(id);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Photo removed");
      router.refresh();
    });
  }

  if (!photos.length && !canAdd) return <p className="rec-muted">No photos.</p>;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {photos.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="flex min-w-0 flex-col gap-1">
              <a href={`/api/maintenance/photos/${p.id}`} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-card">
                {/* Unoptimized: the photo comes from the app's own no-store route, never an image cache. */}
                <Image src={`/api/maintenance/photos/${p.id}`} alt={`Photo added by ${p.addedByName}`} fill unoptimized className="object-cover" />
                <span className="sr-only"> (opens full size in a new tab)</span>
              </a>
              <div className="flex min-w-0 items-start justify-between gap-1">
                <span className="rec-muted rec-small min-w-0 break-words">{p.addedByName} · {formatDateTime(new Date(p.createdAt))}</span>
                {canRemove ? <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" disabled={pending} onClick={() => remove(p.id)}><Trash2 aria-hidden="true" /><span className="sr-only">Remove this photo</span></Button> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      {canAdd ? (
        <div className="relative flex min-w-0 flex-wrap items-center gap-3">
          <Input ref={picker} type="file" accept={acceptFor(["photo"])} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => add(e.target.files?.[0])} />
          <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => picker.current?.click()}><Camera aria-hidden="true" />{pending ? "Adding…" : "Add a photo"}</Button>
          <span className="rec-muted rec-small">Up to {MAX_PHOTOS}, {sizeLimit(MAX_PHOTO_BYTES)} each, kept without their location</span>
        </div>
      ) : null}
    </div>
  );
}
