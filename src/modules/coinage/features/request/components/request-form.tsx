"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { saveCoinage } from "@/modules/coinage/features/request/server/actions";
import { coinageNextStep, denominations, euros, type CoinageFields, type CoinageView } from "@/modules/coinage/shared/types";
import { plural, today } from "@/lib/format";

/** Whole cents from what was typed, or null while it isn't a euro amount yet. */
const typedCents = (value = "") => /^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value.trim()) * 100) : null;

/** The request form and its save and send buttons, which share one pending state. On a new
 *  request the buttons sit under the form; on a request being changed they lead the Next action
 *  panel beside it, with `actions` (withdraw) under them and `children` (history) under the form. */
export function CoinageRequestForm({ id, row, sites, defaultSite = "", actions, children }: {
  id: string; row?: CoinageView; sites: { id: string; name: string }[]; defaultSite?: string; actions?: ReactNode; children?: ReactNode;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<CoinageFields>(() => ({
    clubId: row?.clubId || defaultSite, forWhom: row?.forWhom || "", neededBy: row?.neededBy || "", notes: row?.notes || "",
    ...Object.fromEntries(denominations.map(d => [`line${d.cents}`, row?.lines[String(d.cents)] ? (row.lines[String(d.cents)]! / 100).toFixed(2) : ""])),
  }));
  const [pending, setPending] = useState<"save" | "submit" | null>(null), [message, setMessage] = useState<{ error?: string; warning?: string } | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const change = (key: keyof CoinageFields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const total = denominations.reduce((sum, d) => sum + (typedCents(fields[`line${d.cents}`]) ?? 0), 0);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit" ? "submit" : "save";
    const submitted = Object.fromEntries(new FormData(event.currentTarget)) as CoinageFields;
    setFields(submitted);
    const payload = { id, version: row?.version || 0, fields: submitted, action } as const;
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setPending(action); setMessage(null);
    try {
      const result = await saveCoinage({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setMessage({ error: result.error }); return; }
      operation.current = null;
      setMessage({ warning: result.warning || (action === "submit" ? "Request sent to accounts." : "Draft saved.") });
      router.push(`/coinage/${result.id}`); router.refresh();
    } catch { setMessage({ error: "Could not confirm the save. Your entries are still here; try again." }); }
    finally { setPending(null); }
  }
  const resend = row?.status === "NEEDS_INFORMATION";
  const feedback = message && <Notice tone={message.error ? "error" : "info"} live={message.error ? "alert" : "status"} title={message.error || message.warning} />;
  // Save comes first in the document, so Enter in a field saves a draft and never sends.
  const buttons = <>
    <LoadingButton type="submit" form="coinage-form" value="save" variant="outline" pending={pending === "save"} pendingLabel="Saving…" disabled={pending === "submit"}>{resend ? "Save changes" : "Save draft"}</LoadingButton>
    <LoadingButton type="submit" form="coinage-form" value="submit" pending={pending === "submit"} pendingLabel="Sending…" disabled={pending === "save"}><Send aria-hidden="true" />{resend ? "Send to accounts again" : "Send to accounts"}</LoadingButton>
  </>;
  const form = <form id="coinage-form" method="post" onSubmit={save} className="flex min-w-0 flex-col gap-4">
    <fieldset disabled={pending !== null} className="flex min-w-0 flex-col gap-4">
      <legend className="sr-only">Coinage request details</legend>
      <section className="pc-panel" aria-labelledby="coinage-where-heading"><h2 id="coinage-where-heading" className="text-lg font-semibold">Where and when</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select id="coinage-site" name="clubId" label="Site" value={fields.clubId} onValueChange={value => change("clubId", value)} placeholder="Choose a site" required options={sites.map(site => ({ value: site.id, label: site.name }))} />
          <Input id="coinage-for" name="forWhom" label="Who it is for" value={fields.forWhom} onChange={value => change("forWhom", value)} maxLength={200} description="The till, desk or area, such as ‘Reception till 2’." />
          <Input id="coinage-needed" name="neededBy" label="Needed by" type="date" min={row ? undefined : today()} value={fields.neededBy} onChange={value => change("neededBy", value)} />
        </div>
      </section>
      <section className="pc-panel" aria-labelledby="coinage-lines-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="coinage-lines-heading" className="text-lg font-semibold">Coins</h2>
          <p className="font-semibold tabular-nums" aria-live="polite">Total {euros(total)}</p>
        </div>
        <p className="text-sm text-ui-muted-foreground">Enter the value in euro for each coin you need, such as 50.00 for €50 of €2 coins. Leave the rest empty.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {denominations.map(d => {
            const key = `line${d.cents}` as const, cents = typedCents(fields[key]);
            const count = cents && cents % d.cents === 0 ? plural(cents / d.cents, "coin") : undefined;
            return <Input key={d.cents} id={`coinage-${key}`} name={key} label={`${d.label} (€)`} value={fields[key] ?? ""} onChange={value => change(key, value)} inputMode="decimal" maxLength={10} description={count} />;
          })}
        </div>
      </section>
      <section className="pc-panel" aria-labelledby="coinage-notes-heading"><h2 id="coinage-notes-heading" className="text-lg font-semibold">Notes for accounts</h2>
        <Textarea id="coinage-notes" name="notes" label="Notes" optional value={fields.notes} onChange={event => change("notes", event.target.value)} maxLength={4000} rows={3} placeholder="Anything accounts should know, such as a busy weekend or an event." />
      </section>
      <p className="pc-note text-sm"><CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ui-primary" /><span>A draft needs only the site. Before sending, also add who it is for, when it is needed and at least one coin.</span></p>
    </fieldset>
    {row ? null : <>
      {feedback}
      <div className="pc-panel"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Not sent yet</p><div className="flex flex-wrap gap-2">{buttons}</div></div></div>
    </>}
  </form>;
  if (!row) return form;
  return <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
    <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">{form}{children}</div>
    <aside className="pc-panel" aria-labelledby="next-action">
      <h2 id="next-action" className="text-lg font-semibold">Next action</h2>
      <p className="text-sm text-ui-muted-foreground">{coinageNextStep(row.status)}</p>
      {feedback}
      <div className="flex flex-col gap-2">{buttons}</div>
      {actions}
    </aside>
  </div>;
}
