"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import type { ActionConfirmation, ActionResult, ConfirmationReply } from "@/lib/action-result";
import { toast } from "@/lib/toast";

/** Keeps a reviewable server confirmation and the original form together. */
export function ProfileActionDialog({ trigger, title, description, submitLabel = "Save", success = "Saved", submit, children }: {
  trigger: React.ReactNode; title: string; description: string; submitLabel?: string; success?: string;
  submit: (data: FormData, confirmation?: ConfirmationReply) => Promise<ActionResult>; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null);
  const [pending, startTransition] = useTransition();
  const data = useRef<FormData | null>(null), busy = useRef(false);
  const router = useRouter();
  function run(values: FormData, reply?: ConfirmationReply) {
    if (busy.current) return;
    busy.current = true; data.current = values; setError("");
    startTransition(async () => {
      try {
        const result = await submit(values, reply);
        if (!result.ok) { setConfirmation(result.confirmation ?? null); setError(result.confirmation ? "" : result.error); return; }
        setOpen(false); setConfirmation(null); toast.success(success); router.refresh();
      } catch { setError("Could not confirm the save. Your entries are still here; please try again."); }
      finally { busy.current = false; }
    });
  }
  function changeOpen(next: boolean) { if (!pending) { setOpen(next); setError(""); if (!next) setConfirmation(null); } }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); run(new FormData(event.currentTarget)); }} className="space-y-5">
        <fieldset disabled={pending || !!confirmation} hidden={!!confirmation} className="min-w-0 space-y-4">{children}</fieldset>
        {confirmation ? <section className="space-y-3" aria-label="Confirm this change"><h3 className="font-semibold">{confirmation.title}</h3><p className="whitespace-pre-line text-sm">{confirmation.description}</p></section> : null}
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => confirmation ? setConfirmation(null) : changeOpen(false)}>{confirmation ? "Back" : "Cancel"}</Button>
          {confirmation ? confirmation.choices.map(choice => <Button type="button" key={choice.value} disabled={pending} onClick={() => data.current && run(data.current, { choice: choice.value, ids: confirmation.ids })}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{choice.label}</Button>)
            : <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{submitLabel}</Button>}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
