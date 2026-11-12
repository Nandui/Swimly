"use client";

import { useRouter } from "next/navigation";
import { Plus, Send, Trash2 } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { formatDateRange } from "@/lib/format";
import { assignShift, createBlock, deleteBlock, publishBlock, recordAck } from "@/modules/staffing/features/blocks/server/actions";
import { PersonPicker, shiftLabel, text, THEME, useRefresh } from "@/modules/staffing/shared/components/kit";
import { blockEnd, formatHours, type Candidate, type FitShift, type StaffingSettings } from "@/modules/staffing/shared/rules";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Start a block on one of the next Mondays, from the site's slots and the block before. */
export function StartBlockDialog({ siteId, siteName, mondays }: { siteId: string; siteName: string; mondays: string[] }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} trigger={<Button><Plus aria-hidden="true" />Start a block</Button>}
      title="Start a rota block" description={`Two weeks at ${siteName}: every slot on each day, with the same people as the block before where they are still on the rota.`}
      submitLabel="Start block" successMessage="Block started"
      submit={async (fd) => {
        const result = await createBlock(siteId, text(fd, "startsOn"));
        if (result.ok) router.push(`/staffing/blocks/${result.id}`);
        return result.ok ? { ok: true } : result;
      }}>
      <Field label="Two weeks from" htmlFor="stf-start">
        <NativeSelect id="stf-start" name="startsOn" defaultValue={mondays[0]} className="min-h-11 w-full">
          {mondays.map((m) => <NativeSelectOption key={m} value={m}>{formatDateRange(day(m), day(blockEnd(m)))}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}

/** Publish (BR-2.2, 3.8): when people are below contracted hours, say why it is accepted. */
export function PublishDialog({ blockId, short }: { blockId: string; short: { name: string; short: number }[] }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} trigger={<Button><Send aria-hidden="true" />Publish</Button>}
      title="Publish this block?" description="Everyone on it is asked to acknowledge it within 48 hours. After this, shifts change only by a swap, an absence, or a manager with a reason."
      submitLabel="Publish" successMessage="Block published" onSuccess={refresh}
      submit={(fd) => publishBlock(blockId, text(fd, "acceptShort"))}>
      {short.length ? (
        <>
          <p className="text-sm">Below contracted hours in at least one week:</p>
          <ul className="text-sm text-ui-muted-foreground">{short.map((s) => <li key={s.name}>{s.name}: {formatHours(s.short)} short</li>)}</ul>
          <Field label="Why do you accept it?" htmlFor="stf-short" hint="For example: agreed with them, or no slots the centre needs. Kept in the log.">
            <Textarea id="stf-short" name="acceptShort" required minLength={3} maxLength={500} />
          </Field>
        </>
      ) : <p className="text-sm text-ui-muted-foreground">Everyone with contracted hours has them in both weeks.</p>}
    </FormDialog>
  );
}

export function DeleteBlockDialog({ blockId }: { blockId: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME} destructive trigger={<Button variant="ghost"><Trash2 aria-hidden="true" />Delete draft</Button>}
      title="Delete this draft block?" description="Its places and who is on them go. Start it again from the slots whenever you like."
      submitLabel="Delete" successMessage="Draft deleted"
      submit={async () => {
        const result = await deleteBlock(blockId);
        if (result.ok) router.push("/staffing");
        return result;
      }}>
      <p className="text-sm text-ui-muted-foreground">Nothing has been published from it.</p>
    </FormDialog>
  );
}

/** Choose or change who is on a place. On a published block it is a Manage override with a reason. */
export function AssignPlace({ shift, people, shifts, settings, published, current }: {
  shift: FitShift & { id: string; name: string }; people: readonly Candidate[]; shifts: readonly (FitShift & { userId: string })[]; settings: StaffingSettings; published: boolean; current: string | null;
}) {
  return (
    <PersonPicker shift={shift} people={people} shifts={shifts} settings={settings} exclude={current ? [current] : []} allowNobody={!!current} reason={published}
      trigger={<Button variant={current ? "outline" : "default"}>{current ? "Change" : "Choose"}</Button>}
      title={current ? "Change who is on" : "Who takes this place?"} description={shiftLabel(shift)}
      submitLabel="Save" successMessage="Place saved"
      act={(userId, reason) => assignShift(shift.id, { userId, reason })} />
  );
}

export function AckButtons({ blockId, userId, name, acknowledged }: { blockId: string; userId: string; name: string; acknowledged: boolean }) {
  const refresh = useRefresh();
  if (acknowledged) return null;
  return (
    <span className="flex gap-2">
      <FormDialog portalClassName={THEME} trigger={<Button variant="outline">Phoned</Button>} title={`Phoned ${name}?`} description="Record that you phoned them to acknowledge the rota."
        submitLabel="Record call" successMessage="Call recorded" onSuccess={refresh} submit={() => recordAck(blockId, userId, "phoned")}>
        <p className="text-sm text-ui-muted-foreground">Their shifts stand whether or not they acknowledge.</p>
      </FormDialog>
      <FormDialog portalClassName={THEME} trigger={<Button variant="outline">Acknowledged</Button>} title={`${name} acknowledged?`} description="Record that they confirmed they have seen this block."
        submitLabel="Record" successMessage="Acknowledgement recorded" onSuccess={refresh} submit={() => recordAck(blockId, userId, "acknowledged")}>
        <p className="text-sm text-ui-muted-foreground">Turnfin Me will let staff acknowledge for themselves.</p>
      </FormDialog>
    </span>
  );
}
