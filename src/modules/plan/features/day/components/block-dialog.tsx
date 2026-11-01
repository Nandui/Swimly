"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/form-dialog";
import { saveBlock } from "@/modules/plan/features/day/server/actions";
import { ChoiceField, TimeField } from "@/modules/plan/shared/components/fields";

type Duty = { id: string; name: string; isBreak: boolean; defaultMinutes: number | null };
type SessionOption = { id: string; title: string; start: number; end: number; dutyIds: string[] };
export type BlockDraft = { id?: string; shiftId: string; dutyId: string; sessionId: string | null; start: number; end: number };

/** Put someone on a duty for part of their shift, for a session that needs it or on its own; or
 *  change one they are on. A break is a duty too. */
export function BlockDialog({ trigger, draft, duties, sessions, who, onDone }: {
  trigger: React.ReactNode; draft: BlockDraft; duties: Duty[]; sessions: SessionOption[]; who: string; onDone?: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState(draft);
  const set = <K extends keyof BlockDraft>(key: K, value: BlockDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const fitting = sessions.filter((s) => s.dutyIds.includes(f.dutyId));
  function chooseDuty(dutyId: string) {
    const duty = duties.find((d) => d.id === dutyId);
    setF((x) => ({ ...x, dutyId, sessionId: sessions.some((s) => s.id === x.sessionId && s.dutyIds.includes(dutyId)) ? x.sessionId : null,
      end: !x.id && duty?.defaultMinutes ? Math.min(1440, x.start + duty.defaultMinutes) : x.end }));
  }
  return (
    <FormDialog portalClassName="turnfin-module" trigger={trigger} width="sm:max-w-lg"
      title={draft.id ? `Change ${who}'s duty` : `Put ${who} on a duty`}
      description="It has to fit inside their shift, and inside the session when it fills one."
      submitLabel={draft.id ? "Save duty" : "Put on"} successMessage={draft.id ? "Duty saved" : "Duty added"}
      onOpen={() => setF(draft)} onSuccess={() => { router.refresh(); onDone?.(); }}
      submit={() => saveBlock({ shiftId: f.shiftId, dutyId: f.dutyId, sessionId: f.sessionId, start: f.start, end: f.end }, draft.id)}>
      <ChoiceField id="plan-block-duty" label="Duty" value={f.dutyId} onChange={chooseDuty} options={duties} empty="Choose a duty" />
      {fitting.length ? (
        <ChoiceField id="plan-block-session" label="For" value={f.sessionId ?? ""} onChange={(v) => set("sessionId", v || null)} optional empty="Nothing in particular"
          options={fitting.map((s) => ({ id: s.id, name: s.title }))} hint="Filling a place on what's on closes its gap." />
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <TimeField id="plan-block-start" label="From" value={f.start} onChange={(v) => set("start", v ?? 0)} />
        <TimeField id="plan-block-end" label="To" value={f.end} onChange={(v) => set("end", v ?? 0)} />
      </div>
    </FormDialog>
  );
}
