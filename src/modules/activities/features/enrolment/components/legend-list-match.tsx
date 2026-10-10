"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { FileField } from "@/components/ui/file-field";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { applyLegendList, previewLegendList, type LegendListPreview } from "@/modules/activities/features/enrolment/server/actions/legend-list";
import { toast } from "@/components/ui/toast";
import { formatCount, plural } from "@/lib/format";

const places = (n: number) => plural(n, "place");

/** Upload the list exported from Legend: every place still to check whose
 *  member number is on it is confirmed as updated in Legend. The count comes
 *  first; nothing is saved until Confirm. */
export function LegendListMatch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LegendListPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const form = (f: File) => { const data = new FormData(); data.set("file", f); return data; };

  function check(f: File) {
    setError(null);
    startCheck(async () => {
      const result = await previewLegendList(form(f));
      if (result.ok) setPreview(result.preview); else { setPreview(null); setError(result.error); }
    });
  }
  function confirmAll() {
    if (!file) return;
    startConfirm(async () => {
      const result = await applyLegendList(form(file));
      if (!result.ok) { setError(result.error); return; }
      toast.success(`${places(result.confirmed ?? 0)} confirmed as updated in Legend`);
      setOpen(false); setFile(null); setPreview(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!confirming) { setOpen(next); if (!next) { setFile(null); setPreview(null); setError(null); } } }}>
      <DialogTrigger asChild><Button variant="outline"><Upload aria-hidden="true" />Upload Legend list</Button></DialogTrigger>
      <DialogContent className="flex flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Legend list</DialogTitle>
          <DialogDescription>Every place still to check whose member number is on the list is confirmed as updated in Legend, at every site.</DialogDescription>
        </DialogHeader>

        <FileField id="legend-list-file" label="List from Legend" description="The .xlsx export from Legend." accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(null); if (f) check(f); }} />
        {checking ? <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><FileSpreadsheet aria-hidden="true" className="size-4" />Matching member numbers…</p> : null}
        {error ? <Notice tone="error" live="alert" title={error} /> : null}

        {preview ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-ui-lg border border-ui-border bg-ui-accent p-4">
              <p className="text-2xl font-bold tabular-nums">{places(preview.places)}</p>
              <p className="text-sm text-ui-muted-foreground">
                {preview.places ? `${plural(preview.swimmers, "swimmer")} from ${plural(preview.members, "member number")} on the list. ${preview.bySite.map((s) => `${s.name}: ${formatCount(s.places)}`).join(" · ")}` : `None of the ${formatCount(preview.members)} member numbers has a place still to check.`}
              </p>
            </div>
            {preview.places ? (
              <LoadingButton type="button" pending={confirming} pendingLabel="Confirming…" onClick={confirmAll} className="min-h-11 self-start">
                <CheckCheck aria-hidden="true" />Confirm {places(preview.places)}
              </LoadingButton>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
