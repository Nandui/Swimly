"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { saveDayNote } from "@/lib/rota/actions";
import { toast } from "@/lib/toast";

/** The day's note on the plan: who covers whom and why, a last day,
 *  anything the duty manager should know. Saved on its own; empty removes it. */
export function DayNote({ siteId, date, text, label }: { siteId: string; date: string; text: string; label: string }) {
  const router = useRouter();
  const [value, setValue] = useState(text);
  const [saving, start] = useTransition();
  const changed = value.trim() !== text.trim();
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const result = await saveDayNote(siteId, date, value);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success(value.trim() ? "Note saved" : "Note removed");
        router.refresh();
      });
    }}>
      <Label htmlFor={`note-${date}`}>Notes</Label>
      <Textarea id={`note-${date}`} value={value} onChange={(e) => setValue(e.target.value)} maxLength={1000} rows={3}
        placeholder="For example: Sam covers the 16:20 classes, Alex is on holiday." aria-label={`Notes for ${label}`} />
      {changed ? <Button type="submit" variant="outline" disabled={saving}>{saving ? "Saving…" : "Save note"}</Button> : null}
    </form>
  );
}
