"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { ConfirmAction } from "@/components/confirm-action";
import { toast } from "@/components/ui/toast";
import { PICTURE_ACCEPT, PICTURE_MAX_BYTES, PICTURE_TYPES } from "@/lib/images/picture-rules";
import { setSupplierPicture } from "@/modules/purchasing/features/suppliers/server/actions";

/** Add, change or take off a supplier's picture, on its page. Choosing a file saves it
 *  straight away; the old picture is replaced. */
export function SupplierPictureControls({ id, name, hasPicture }: { id: string; name: string; hasPicture: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const choose = (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (file.size > PICTURE_MAX_BYTES || !PICTURE_TYPES.includes(file.type)) { toast.error("Choose a JPG, PNG or WebP picture up to 2 MB."); return; }
    start(async () => {
      const form = new FormData();
      form.set("picture", file);
      const r = await setSupplierPicture(id, form);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Picture saved");
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input ref={input} type="file" accept={PICTURE_ACCEPT} tabIndex={-1} aria-hidden="true" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        <Button type="button" variant="outline" className="min-h-11" aria-busy={pending || undefined} disabled={pending} onClick={() => input.current?.click()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
          {pending ? "Saving picture…" : hasPicture ? "Change picture" : "Add a picture"}
        </Button>
        {hasPicture ? (
          <ConfirmAction
            trigger={<Button type="button" variant="ghost" className="min-h-11" disabled={pending}><Trash2 aria-hidden="true" />Remove picture</Button>}
            title={`Remove the picture of ${name}?`}
            description="Its initials show instead. You can add a picture again at any time."
            confirmLabel="Remove"
            successMessage="Picture removed"
            destructive
            run={async () => { const r = await setSupplierPicture(id, new FormData()); if (r.ok) router.refresh(); return r; }}
          />
        ) : null}
      </div>
      <p className="po-fine">Its logo or a photo: JPG, PNG or WebP, up to 2 MB. It shows wherever the supplier is listed or picked.</p>
    </div>
  );
}
