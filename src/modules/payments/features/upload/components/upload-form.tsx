"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { FileField } from "@/components/ui/file-field";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { formatCount, plural } from "@/lib/format";
import { previewFailureSheet, uploadFailureSheet, type SheetPreview } from "@/modules/payments/features/upload/server/actions";
import { monthFromFileName } from "@/modules/payments/shared/rules";
import { euro, monthLabel } from "@/modules/payments/shared/types";

/** The last twelve months, newest first, with last month chosen: the sheet arrives after the run. */
function recentMonths(todayIso: string) {
  const [y, m] = [Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7))];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Upload the bank's failure sheet: choose the file, check the month (read from its name, such as
 *  "Failed Lessons 09"), see what it adds per site, then add them. Nothing is saved until Add. */
export function UploadForm({ today }: { today: string }) {
  const router = useRouter();
  const months = recentMonths(today);
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState(months[1]);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();
  const operation = useRef("");
  const form = (f: File, m: string) => {
    const data = new FormData();
    data.set("file", f); data.set("month", m); data.set("operationId", operation.current);
    return data;
  };

  function check(f: File, m: string) {
    setError(null); setPreview(null); operation.current = crypto.randomUUID();
    startCheck(async () => {
      const result = await previewFailureSheet(form(f, m));
      if (result.ok) setPreview(result.preview); else setError(result.error);
    });
  }
  function choose(f: File | null) {
    setFile(f);
    if (!f) { setPreview(null); return; }
    const guess = monthFromFileName(f.name, today);
    const m = months.includes(guess) ? guess : month;
    setMonth(m);
    check(f, m);
  }
  function add() {
    if (!file || !preview) return;
    startSave(async () => {
      const result = await uploadFailureSheet(form(file, preview.month));
      if (!result.ok) { setError(result.error); return; }
      toast.success(`${plural(result.added, "failed payment")} added for ${monthLabel(result.month)}`);
      router.push(`/payments?show=to_contact&month=${result.month}`);
    });
  }
  const blocked = !!preview && (preview.unknownClubs.length > 0 || preview.added === 0);

  return (
    <div className="flex max-w-2xl min-w-0 flex-col gap-6">
      <FileField id="payments-sheet" label="Failure sheet" description="The .xlsx the bank sends each month, with a tab per site."
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" pending={checking} pendingLabel="Reading the sheet…"
        onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      <Field label="Month collected" htmlFor="payments-month" hint="Read from the file’s name when it has one. Change it if it is wrong.">
        <NativeSelect id="payments-month" className="min-h-11 w-full" value={month} disabled={checking || saving}
          onChange={(e) => { setMonth(e.target.value); if (file) check(file, e.target.value); }}>
          {months.map((m) => <NativeSelectOption key={m} value={m}>{monthLabel(m)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}

      {preview ? (
        <section aria-labelledby="payments-preview-h" className="flex flex-col gap-4">
          <div className="rounded-ui-lg border border-ui-border bg-ui-accent p-4">
            <h2 id="payments-preview-h" className="text-2xl font-bold tabular-nums">{plural(preview.added, "failed payment")} to add</h2>
            <p className="text-sm text-ui-muted-foreground">
              {[
                `${preview.monthLabel}, ${euro(preview.addedCents)} in all`,
                preview.bySite.map((s) => `${s.name}: ${formatCount(s.added)} (${s.cents})`).join(" · "),
                preview.swimmers ? `${plural(preview.swimmers, "is a swimmer", "are swimmers")} on the swim school’s records` : null,
              ].filter(Boolean).join(". ")}.
            </p>
            {preview.already || preview.elsewhere ? (
              <p className="mt-2 text-sm text-ui-muted-foreground">
                {[preview.already ? `${plural(preview.already, "debit")} already in for ${preview.monthLabel}, left as they are` : null,
                  preview.elsewhere ? `${plural(preview.elsewhere, "debit")} at sites you don’t manage, left for their managers` : null].filter(Boolean).join(". ")}.
              </p>
            ) : null}
          </div>
          {preview.unknownClubs.length ? (
            <Notice tone="error" title={`No site matches ${preview.unknownClubs.join(", ")}`}
              description="Check the Club Name column on the sheet, or the site’s name in Admin › Sites, then upload it again. Nothing has been saved." />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <LoadingButton type="button" pending={saving} pendingLabel="Adding…" onClick={add} disabled={blocked} className="min-h-11">
              <CheckCheck aria-hidden="true" />Add {plural(preview.added, "failed payment")}
            </LoadingButton>
            <Button asChild variant="outline" className="min-h-11"><Link href="/payments">Cancel</Link></Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
