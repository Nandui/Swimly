"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/ui-kit/tag";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { markRegister } from "@/lib/attendance/actions/register";
import { ATTENDANCE_ORDER, ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import type { RegisterLine } from "@/lib/attendance/data/register";
import { ageInYears } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The pool-deck screen.
 *
 *  Touch first: nothing is hidden behind hover, the targets are 40px on a
 *  phone, and an unmarked child starts absent, so the instructor ticks who is
 *  in the water. A saved register never says a child was here unless someone
 *  said so; "Everyone in" is the one tap for a full class.
 *
 *  It holds the class in local state behind one Save. That is not a style
 *  choice: Next dispatches Server Actions one at a time per client, so a save
 *  per tap would queue on poolside wifi. Batching also means a dropped
 *  connection leaves the marks in the tab, and the `localStorage` mirror means
 *  they survive the tab being closed. */

const SELECTED: Record<AttendanceStatus, string> = {
  PRESENT: "bg-(--tag-green-bg) text-(--tag-green-fg) border-(--tag-green-bg)",
  LATE: "bg-(--tag-orange-bg) text-(--tag-orange-fg) border-(--tag-orange-bg)",
  ABSENT: "bg-(--tag-red-bg) text-(--tag-red-fg) border-(--tag-red-bg)",
};

type Mark = { status: AttendanceStatus; note: string };

function storageKey(courseId: string, date: string) {
  return `swimly:register:${courseId}:${date}`;
}

export function RegisterForm({
  courseId,
  date,
  lines,
  classNote,
  readOnly,
  continueHref,
}: {
  courseId: string;
  date: string;
  lines: RegisterLine[];
  classNote: string | null;
  readOnly: boolean;
  /** Where a successful save goes next. Set by the deck's class flow, where
   *  attendance is step one and the competencies are step two; the register
   *  page on its own leaves it out and stays put. */
  continueHref?: string;
}) {
  const router = useRouter();
  const initial = React.useMemo(() => {
    const map = new Map<string, Mark>();
    for (const line of lines) {
      map.set(line.studentId, { status: line.status ?? "ABSENT", note: line.note ?? "" });
    }
    return map;
  }, [lines]);

  const [marks, setMarks] = React.useState(initial);
  const [note, setNote] = React.useState(classNote ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const key = storageKey(courseId, date);

  // Reading a browser-only store after hydration is what an effect is for —
  // the server has no localStorage, so doing it during render would mismatch
  // the markup. The rule cannot tell this apart from a prop-sync effect, which
  // is the thing it is actually warning about; that one is handled below,
  // during render, the way React recommends.
  React.useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as Record<string, Mark>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarks((previous) => {
        const next = new Map(previous);
        for (const [studentId, mark] of Object.entries(stored)) {
          if (next.has(studentId)) next.set(studentId, mark);
        }
        return next;
      });
      setDirty(true);
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key]);

  // When a save revalidates and the server sends fresh lines, adopt them.
  // Compared during render rather than resynced in an effect, so it costs no
  // extra render pass — React's documented "adjusting state on prop change".
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    setMarks(initial);
    setNote(classNote ?? "");
    setDirty(false);
  }

  function remember(next: Map<string, Mark>) {
    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(next)));
  }

  function set(studentId: string, status: AttendanceStatus) {
    setMarks((previous) => {
      const next = new Map(previous);
      next.set(studentId, { ...(next.get(studentId) ?? { note: "" }), status });
      remember(next);
      return next;
    });
    setDirty(true);
  }

  function setAll(status: AttendanceStatus) {
    setMarks((previous) => {
      const next = new Map<string, Mark>();
      for (const [studentId, mark] of previous) next.set(studentId, { ...mark, status });
      remember(next);
      return next;
    });
    setDirty(true);
  }

  function save() {
    startTransition(async () => {
      const result = await markRegister({
        courseId,
        date,
        marks: [...marks.entries()].map(([studentId, mark]) => ({
          studentId,
          status: mark.status,
          note: mark.note || undefined,
        })),
        classNote: note.trim() || undefined,
      });

      if (result.ok) {
        window.localStorage.removeItem(key);
        toast.success("Attendance saved");
        startTransition(() => {
          setError(null);
          setDirty(false);
        });
        if (continueHref) router.push(continueHref);
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  const counts = ATTENDANCE_ORDER.map((status) => ({
    status,
    count: [...marks.values()].filter((mark) => mark.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm text-muted-foreground">
          {counts.map((entry, index) => (
            <span key={entry.status}>
              {index > 0 ? ", " : ""}
              <span className="font-medium text-foreground tabular-nums">{entry.count}</span>{" "}
              {ATTENDANCE_STATUS_META[entry.status].label.toLowerCase()}
            </span>
          ))}
        </p>
        {readOnly ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll("PRESENT")}>
            Everyone in
          </Button>
        )}
      </div>

      <ul className="overflow-hidden rounded-md border">
        {lines.map((line) => {
          const mark = marks.get(line.studentId);
          const name = `${line.firstName} ${line.lastName}`;
          return (
            <li key={line.studentId} className="border-b p-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {name}
                    {line.offRoster ? (
                      <Tag color="gray" className="ml-2">
                        No longer in this class
                      </Tag>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {line.dateOfBirth ? `${ageInYears(line.dateOfBirth)} · ` : ""}
                    {line.levelName || "—"}
                  </p>
                  {line.medicalNotes ? (
                    <details className="mt-1">
                      <summary className="inline-flex cursor-pointer list-none">
                        <Tag color="red">Medical</Tag>
                      </summary>
                      <p className="mt-1 max-w-prose text-xs whitespace-pre-wrap text-(--tag-red-fg)">
                        {line.medicalNotes}
                      </p>
                    </details>
                  ) : null}
                </div>

                <div
                  role="group"
                  aria-label={`Attendance for ${name}`}
                  className="flex w-full gap-1 sm:w-auto"
                >
                  {ATTENDANCE_ORDER.map((status) => {
                    const active = mark?.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={active}
                        aria-label={`${ATTENDANCE_STATUS_META[status].label} — ${name}`}
                        onClick={() => set(line.studentId, status)}
                        className={cn(
                          "h-10 flex-1 rounded-md border text-[13px] font-medium transition-colors sm:h-8 sm:w-16 sm:flex-none",
                          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          "disabled:pointer-events-none disabled:opacity-60",
                          active
                            ? SELECTED[status]
                            : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {ATTENDANCE_STATUS_META[status].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <label htmlFor="classNote" className="block text-[13px] font-medium text-foreground">
          Anything about the class itself
        </label>
        <Textarea
          id="classNote"
          value={note}
          disabled={readOnly}
          onChange={(event) => {
            setNote(event.target.value);
            setDirty(true);
          }}
          rows={2}
          placeholder="Pool closed — no class this week"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
        >
          {error}
        </p>
      ) : null}

      {readOnly ? null : (
        // Clears the home indicator on a phone: the bottom padding grows by
        // the safe-area inset, which is zero everywhere that has none.
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Not saved yet" : "Up to date"}
          </p>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : continueHref ? (
              <>
                Save and continue
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <Check className="size-4" />
                Save attendance
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
