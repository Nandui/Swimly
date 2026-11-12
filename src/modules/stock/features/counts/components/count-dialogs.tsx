"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { deleteCount, discardCount, startCount, submitCount } from "@/modules/stock/features/counts/server/actions";
import { text, THEME, useRefresh } from "@/modules/stock/shared/components/form-kit";

/** The count dialogs: start, submit, discard and delete. */

export function StartCountDialog({ sites, today, trigger }: { sites: { id: string; name: string; open: boolean }[]; today: string; trigger?: React.ReactNode }) {
  const router = useRouter();
  const free = sites.filter((s) => !s.open);
  return (
    <FormDialog portalClassName={THEME}
      trigger={trigger ?? <Button><Plus aria-hidden="true" />Start a count</Button>}
      title="Start a stock count" description="Choose the site you are standing in and the day this count is for. A site has one open count at a time."
      submitLabel="Start count" successMessage="Count started"
      submit={async (fd) => {
        const result = await startCount({ siteId: text(fd, "siteId"), stockDate: text(fd, "stockDate"), notes: text(fd, "notes") });
        if (result.ok && result.id) router.push(`/stock/${result.id}`);
        return result;
      }}>
      <Field label="Site" htmlFor="stk-site" hint={free.length < sites.length ? "Sites with a count open carry on with that one." : undefined}>
        <NativeSelect id="stk-site" name="siteId" required defaultValue={free.length === 1 ? free[0].id : ""} className="min-h-11 w-full">
          <NativeSelectOption value="">Choose the site</NativeSelectOption>
          {sites.map((s) => <NativeSelectOption key={s.id} value={s.id} disabled={s.open}>{s.name}{s.open ? " (count open)" : ""}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Stock day" htmlFor="stk-day"><Input id="stk-day" name="stockDate" type="date" required defaultValue={today} className="min-h-11" /></Field>
      <Field label="Note" htmlFor="stk-note" optional><Textarea id="stk-note" name="notes" maxLength={500} placeholder="Month-end count, or anything the next person should know." /></Field>
    </FormDialog>
  );
}

export function SubmitCount({ id, counted, total }: { id: string; counted: number; total: number }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title="Submit this count?"
      description={`${counted} of ${total} products have a number. Products not counted stay not counted; they are never taken as none. After submitting, the count can't be changed.`}
      trigger={<Button type="button" disabled={counted === 0}>Submit count</Button>}
      submitLabel="Submit count" successMessage="Count submitted" onSuccess={refresh} submit={() => submitCount(id)}>
      <p className="text-sm text-ui-muted-foreground">It is then ready to compare with the next count.</p>
    </FormDialog>
  );
}

export function DiscardCount({ id }: { id: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it" title="Discard this count?"
      description="Nothing has been counted on it yet, so it can be thrown away."
      trigger={<Button type="button" variant="outline">Discard</Button>}
      submitLabel="Discard" successMessage="Count discarded" onSuccess={() => router.push("/stock")} submit={() => discardCount(id)}>
      <p className="text-sm text-ui-muted-foreground">It stays in the activity log.</p>
    </FormDialog>
  );
}

export function DeleteCount({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} destructive cancelLabel="Keep it" title={`Delete the ${label} count?`}
      description="It and every number on it are removed, and it leaves any comparison."
      trigger={<Button type="button" variant="ghost" className="text-ui-destructive">Delete</Button>}
      submitLabel="Delete count" successMessage="Count deleted" onSuccess={() => router.push("/stock")} submit={() => deleteCount(id)}>
      <p className="text-sm text-ui-muted-foreground">The deletion stays in the activity log.</p>
    </FormDialog>
  );
}
