"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, FileSpreadsheet, ListChecks } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { applyLegendList, previewLegendList, type LegendListPreview, type LegendReviewRow } from "@/modules/activities/lib/enrolment/actions/legend-list";
import { toast } from "@/lib/toast";

const number = (value: number) => value.toLocaleString("en-IE");

/** Confirm many places at once from a list exported from Legend: check the
 *  list first (nothing is saved), then confirm every place it covers at this
 *  site. Places the list does not settle are listed for a person to look at. */
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
      toast.success(`${number(result.confirmed ?? 0)} ${result.confirmed === 1 ? "place" : "places"} confirmed as updated in Legend`);
      setOpen(false); setFile(null); setPreview(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!confirming) setOpen(next); }}>
      <DialogTrigger asChild><Button variant="outline" className="min-h-11"><ListChecks aria-hidden="true" />Match a Legend list</Button></DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match a Legend list</DialogTitle>
          <DialogDescription>Export the members on the Aquatics agreement from Legend (Member Agreements) and upload it. Places at this site whose member is on it are confirmed as updated in Legend.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="legend-list-file">Legend list (.xlsx)</Label>
          <Input id="legend-list-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="min-h-11"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(null); if (f) check(f); }} />
        </div>
        {checking ? <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><FileSpreadsheet aria-hidden="true" className="size-4" />Checking the list…</p> : null}
        {error ? <Notice tone="error" title={error} /> : null}

        {preview ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Figure label="To confirm" value={preview.confirm} hint={`Places at ${preview.siteName}`} strong />
              <Figure label="On the list" value={preview.listed} hint="Members with the agreement" />
              <Figure label="Already confirmed" value={preview.alreadyConfirmed} hint="Nothing to do" />
              <Figure label="At the other site" value={preview.otherSite} hint="Switch site and match again" />
              <Figure label="No swim place" value={preview.notFound} hint="Not in a class here or elsewhere" />
              <Figure label="Check by hand" value={preview.mismatch.length + preview.terminated.length} hint="Listed below" />
            </dl>

            {preview.confirmSample.length ? <Rows title={`To confirm (${number(preview.confirm)})`} rows={preview.confirmSample} more={preview.confirm - preview.confirmSample.length} /> : null}
            {preview.mismatch.length ? <Rows title="Legend names another programme" hint="Not confirmed: check the agreement in Legend, then confirm the place on its own." rows={preview.mismatch} /> : null}
            {preview.terminated.length ? <Rows title="Agreement ended in Legend" hint="Not confirmed: the Legend agreement is terminated." rows={preview.terminated} /> : null}

            <div className="flex flex-wrap items-center gap-3">
              <LoadingButton type="button" pending={confirming} pendingLabel="Confirming…" disabled={!preview.confirm} onClick={confirmAll} className="min-h-11">
                <CheckCheck aria-hidden="true" />Confirm {number(preview.confirm)} {preview.confirm === 1 ? "place" : "places"}
              </LoadingButton>
              <p className="text-sm text-ui-muted-foreground">Each is recorded under your name, as if confirmed one by one.</p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value, hint, strong = false }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={`rounded-ui-lg border p-3 ${strong ? "border-ui-primary bg-ui-accent" : "border-ui-border"}`}>
      <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{number(value)}</dd>
      <dd className="text-xs text-ui-muted-foreground">{hint}</dd>
    </div>
  );
}

function Rows({ title, hint, rows, more = 0 }: { title: string; hint?: string; rows: LegendReviewRow[]; more?: number }) {
  return (
    <section className="flex flex-col gap-2">
      <div><h3 className="text-sm font-semibold">{title}</h3>{hint ? <p className="text-xs text-ui-muted-foreground">{hint}</p> : null}</div>
      <ul className="divide-y divide-ui-border rounded-ui-lg border border-ui-border text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="font-medium">{r.swimmer}</span>
            <span className="text-xs text-ui-muted-foreground tabular-nums">{r.memberNumber}</span>
            <span className="text-ui-muted-foreground">{r.place}</span>
            {r.priceName ? <span className="text-xs text-ui-muted-foreground">Legend: {r.priceName} · Place: {r.programme || "no programme"}</span> : null}
          </li>
        ))}
        {more > 0 ? <li className="px-3 py-2 text-xs text-ui-muted-foreground">and {number(more)} more</li> : null}
      </ul>
    </section>
  );
}
