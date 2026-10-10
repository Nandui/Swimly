"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/shadcn/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { saveDayNote } from "@/modules/rota/features/today/server/actions";
import { toast } from "@/components/ui/toast";

/** The day's note on the plan: who covers whom and why, a last day,
 *  anything the duty manager should know. Saved on its own; empty removes it.
 *  The panel's "Notes" heading names the field (`labelledBy`); Save is always there,
 *  and ready once the note changes. */
export function DayNote({ siteId, date, text, labelledBy }: { siteId: string; date: string; text: string; labelledBy: string }) {
  const router = useRouter();
  const [value, setValue] = useState(text);
  const [saving, start] = useTransition();
  const changed = value.trim() !== text.trim();
  return (
    <form method="post" className="flex flex-col items-start gap-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const result = await saveDayNote(siteId, date, value);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success(value.trim() ? "Note saved" : "Note removed");
        router.refresh();
      });
    }}>
      <Textarea id={`note-${date}`} value={value} onChange={(e) => setValue(e.target.value)} maxLength={1000} rows={3} className="w-full"
        placeholder="Anything the team should know about the day" aria-labelledby={labelledBy} />
      <LoadingButton type="submit" variant="outline" pending={saving} disabled={!changed}>Save note</LoadingButton>
    </form>
  );
}
