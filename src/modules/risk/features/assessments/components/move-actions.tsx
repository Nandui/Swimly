"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BadgeCheck, CircleCheck, Send, Undo2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { moveAssessment } from "@/modules/risk/features/assessments/server/actions";
import type { Move } from "@/modules/risk/shared/types";

const LABEL: Record<Move, string> = {
  submit: "Send for sign-off", owner_approve: "Sign it off", owner_withdraw: "Withdraw your sign-off",
  exec_approve: "Give the executive sign-off", exec_withdraw: "Withdraw the executive sign-off", archive: "Archive", restore: "Bring it back",
};
const ICON: Record<Move, LucideIcon> = { submit: Send, owner_approve: CircleCheck, owner_withdraw: Undo2, exec_approve: BadgeCheck, exec_withdraw: Undo2, archive: Archive, restore: ArchiveRestore };
const SAYS: Record<Move, string> = {
  submit: "Its owner is asked to read it and sign it off. It can still be changed while it waits.",
  owner_approve: "You confirm the hazards and their controls are right. The assessment comes into force and its review clock runs.",
  owner_withdraw: "The assessment stops being in force and waits for sign-off again. Any executive sign-off is cleared too.",
  exec_approve: "You add your sign-off on top of the owner’s. It does not change whether the assessment is in force.",
  exec_withdraw: "The executive sign-off is removed. The assessment stays in force on its owner’s sign-off.",
  archive: "It leaves the lists and stops being reviewed. Everything in it is kept, and it can be brought back.",
  restore: "It returns to where it stood before it was archived.",
};
const DONE: Record<Move, string> = {
  submit: "Sent for sign-off", owner_approve: "Signed off. It is in force.", owner_withdraw: "Sign-off withdrawn", exec_approve: "Executive sign-off given",
  exec_withdraw: "Executive sign-off withdrawn", archive: "Archived", restore: "Brought back",
};
const NOTE: Partial<Record<Move, { label: string; required: boolean }>> = {
  owner_withdraw: { label: "Why it is withdrawn", required: true }, exec_withdraw: { label: "Why it is withdrawn", required: true },
  archive: { label: "Why it is archived", required: false }, owner_approve: { label: "Note", required: false }, exec_approve: { label: "Note", required: false },
};

/** The moves this person can make on an assessment, beside it in "Next action": each opens a
 *  short dialog that says what it does. The first is the one prominent action. */
export function MoveActions({ id, version, moves }: { id: string; version: number; moves: Move[] }) {
  const router = useRouter();
  const [move, setMove] = useState<Move | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const trigger = useRef<HTMLButtonElement | null>(null);

  function open(next: Move, button: HTMLButtonElement) {
    trigger.current = button; operation.current = crypto.randomUUID(); setError(null); setMove(next);
  }
  function send(form: HTMLFormElement) {
    if (!move) return;
    const note = String(new FormData(form).get("note") ?? "");
    start(async () => {
      const result = await moveAssessment({ id, operationId: operation.current, version, move, note });
      if (!result.ok) { setError(result.error); return; }
      setMove(null); toast.success(DONE[move]); router.refresh();
    });
  }
  const Icon = move ? ICON[move] : null;
  const note = move ? NOTE[move] : undefined;
  if (!moves.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {moves.map((m, i) => {
          const MoveIcon = ICON[m];
          return <Button key={m} className="justify-start" variant={i === 0 && (m === "submit" || m === "owner_approve" || m === "exec_approve" || m === "restore") ? "default" : "outline"} disabled={pending} onClick={(e) => open(m, e.currentTarget)}><MoveIcon aria-hidden="true" />{LABEL[m]}</Button>;
        })}
      </div>
      <Dialog open={!!move} onOpenChange={(o) => { if (!o && !pending) setMove(null); }}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader><DialogTitle>{move ? LABEL[move] : ""}</DialogTitle><DialogDescription>{move ? SAYS[move] : ""}</DialogDescription></DialogHeader>
          <form method="post" onSubmit={(e) => { e.preventDefault(); send(e.currentTarget); }} className="space-y-4">
            <fieldset disabled={pending} className="space-y-4">
              {note ? (
                <Field label={note.label} htmlFor="risk-move-note" optional={!note.required}>
                  <Textarea id="risk-move-note" name="note" rows={3} maxLength={1000} required={note.required} />
                </Field>
              ) : null}
              {error ? <Notice tone="error" live="alert" title={error} /> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMove(null)}>Go back</Button>
                <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">{Icon ? <Icon aria-hidden="true" /> : null}{move ? LABEL[move] : ""}</LoadingButton>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
