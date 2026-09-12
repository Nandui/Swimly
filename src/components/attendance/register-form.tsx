"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  HeartPulse,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemGroup, ItemContent } from "@/components/shadcn/item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import {
  MarkChoices,
  TeachingNotice,
} from "@/components/instructor/teaching-ui";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { markRegister } from "@/lib/attendance/actions/register";
import {
  ATTENDANCE_ORDER,
  ATTENDANCE_STATUS_META,
} from "@/lib/attendance/constants";
import type { RegisterLine } from "@/lib/attendance/data/register";
import { ageInYears } from "@/lib/format";
import { parseAttendanceDraft } from "@/lib/attendance/draft";
import {
  SAVE_TIMEOUT_MS,
  SAVE_UNCONFIRMED_MESSAGE,
  withTimeout,
} from "@/lib/save-feedback";
import { toast } from "@/lib/toast";
import { RegisterConflict } from "@/components/attendance/register-conflict";
import type { SavedRegister } from "@/lib/attendance/revision";

export function SaveBar({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[-1rem] z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-ui-border bg-ui-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p
        role="status"
        aria-live="polite"
        className="min-w-0 flex-1 text-sm text-ui-muted-foreground"
      >
        {status}
      </p>
      {children}
    </div>
  );
}

type Mark = { status: AttendanceStatus; note: string };

function storageKey(courseId: string, date: string) {
  return `swimly:register:${courseId}:${date}`;
}

export function RegisterForm(
  props: React.ComponentProps<typeof RegisterFormState>,
) {
  return (
    <RegisterFormState
      key={`${props.courseId}:${props.date}:${props.readOnly}`}
      {...props}
    />
  );
}

function RegisterFormState({
  courseId,
  date,
  revision,
  lines,
  classNote,
  readOnly,
  continueHref,
  teaching = false,
}: {
  courseId: string;
  date: string;
  revision: string;
  lines: RegisterLine[];
  classNote: string | null;
  readOnly: boolean;
  /** Where a successful save goes next. Set by the deck's class flow, where
   *  attendance is step one and the competencies are step two; the register
   *  page on its own leaves it out and stays put. */
  continueHref?: string;
  teaching?: boolean;
}) {
  const router = useRouter();
  const initial = React.useMemo(() => {
    const map = new Map<string, Mark>();
    for (const line of lines) {
      map.set(line.studentId, {
        status: line.status ?? "ABSENT",
        note: line.note ?? "",
      });
    }
    return map;
  }, [lines]);

  const [marks, setMarks] = React.useState(initial);
  const [note, setNote] = React.useState(classNote ?? "");
  const [dirty, setDirty] = React.useState(false);
  // Marks that came back from the phone's mirror rather than from the
  // server: worth saying, because the person may not remember making them.
  const [restored, setRestored] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [storageUnavailable, setStorageUnavailable] = React.useState(false);
  const [baseRevision, setBaseRevision] = React.useState<string | null>(
    revision,
  );
  const [conflict, setConflict] = React.useState<SavedRegister | null>(null);

  const key = storageKey(courseId, date);

  // Reading a browser-only store after hydration is what an effect is for —
  // the server has no localStorage, so doing it during render would mismatch
  // the markup. The rule cannot tell this apart from a prop-sync effect, which
  // is the thing it is actually warning about; that one is handled below,
  // during render, the way React recommends.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw || readOnly) return;
      const stored = parseAttendanceDraft(raw);
      if (!stored) {
        window.localStorage.removeItem(key);
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarks((previous) => {
        const next = new Map(previous);
        for (const [studentId, mark] of Object.entries(stored.marks)) {
          if (next.has(studentId)) next.set(studentId, mark);
        }
        return next;
      });
      if (stored.note !== undefined) setNote(stored.note);
      // Older drafts have no baseline and must be reviewed before overwriting.
      setBaseRevision(stored.revision ?? null);
      setDirty(true);
      setRestored(true);
    } catch {
      setStorageUnavailable(true);
    }
  }, [key, readOnly]);

  // When a save revalidates and the server sends fresh lines, adopt them.
  // Compared during render rather than resynced in an effect, so it costs no
  // extra render pass — React's documented "adjusting state on prop change".
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    if (!dirty) {
      setMarks(initial);
      setNote(classNote ?? "");
      setBaseRevision(revision);
    }
  }

  function remember(
    next: Map<string, Mark>,
    nextNote = note,
    nextRevision = baseRevision,
  ) {
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          marks: Object.fromEntries(next),
          note: nextNote,
          revision: nextRevision,
        }),
      );
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }

  function set(studentId: string, status: AttendanceStatus) {
    const next = new Map(marks);
    next.set(studentId, { ...(next.get(studentId) ?? { note: "" }), status });
    remember(next);
    setMarks(next);
    setDirty(true);
  }

  function setAll(status: AttendanceStatus) {
    const next = new Map<string, Mark>();
    for (const [studentId, mark] of marks)
      next.set(studentId, { ...mark, status });
    remember(next);
    setMarks(next);
    setDirty(true);
  }

  function save(expectedRevision = baseRevision) {
    setBaseRevision(expectedRevision);
    setConflict(null);
    remember(marks, note, expectedRevision);
    startTransition(async () => {
      // A save that cannot reach the server throws rather than returning,
      // and a hung one never returns at all. Both are caught here, because
      // the marks remain in this tab and the person needs a retry path.
      let result: Awaited<ReturnType<typeof markRegister>>;
      try {
        result = await withTimeout(
          markRegister({
            courseId,
            date,
            teaching,
            revision: expectedRevision,
            marks: [...marks.entries()].map(([studentId, mark]) => ({
              studentId,
              status: mark.status,
              note: mark.note || undefined,
            })),
            classNote: note.trim() || undefined,
          }),
          SAVE_TIMEOUT_MS,
        );
      } catch {
        startTransition(() => setError(SAVE_UNCONFIRMED_MESSAGE));
        return;
      }

      if (result.ok) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          setStorageUnavailable(true);
        }
        toast.success("Attendance saved");
        startTransition(() => {
          setError(null);
          setDirty(false);
          setRestored(false);
          setBaseRevision(result.revision);
        });
        if (continueHref) router.push(continueHref);
      } else {
        startTransition(() => {
          setError(result.error);
          setConflict(result.conflict ?? null);
        });
      }
    });
  }

  function useSavedRegister() {
    if (!conflict) return;
    setMarks(
      new Map(
        lines.map((line) => [
          line.studentId,
          conflict.marks[line.studentId] ?? { status: "ABSENT", note: "" },
        ]),
      ),
    );
    setNote(conflict.note);
    setBaseRevision(conflict.revision);
    setDirty(false);
    setRestored(false);
    setConflict(null);
    setError(null);
    try {
      window.localStorage.removeItem(key);
    } catch {
      setStorageUnavailable(true);
    }
    router.refresh();
  }

  const counts = ATTENDANCE_ORDER.map((status) => ({
    status,
    count: [...marks.values()].filter((mark) => mark.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ui-muted-foreground" aria-live="polite">
          {counts
            .map(
              (entry) =>
                entry.count +
                " " +
                ATTENDANCE_STATUS_META[entry.status].label.toLowerCase(),
            )
            .join(" · ")}
        </p>
        {!readOnly ? (
          <Button
            variant="outline"
            onClick={() => setAll("PRESENT")}
            disabled={pending}
          >
            Everyone in
          </Button>
        ) : null}
      </div>
      <ItemGroup className="divide-y divide-ui-border">
        {lines.map((line) => {
          const mark = marks.get(line.studentId),
            name = line.firstName + " " + line.lastName;
          return (
            <Item
              key={line.studentId}
              role="listitem"
              className="items-center rounded-none px-0 py-4"
            >
              <ItemContent className="min-w-0 basis-48">
                <p className="text-base font-semibold">{name}</p>
                <p className="text-sm text-ui-muted-foreground">
                  {line.dateOfBirth ? ageInYears(line.dateOfBirth) + " · " : ""}
                  {line.levelName || "—"}
                  {line.offRoster ? " · No longer in this class" : ""}
                </p>
                {line.medicalNotes ? (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-1">
                        <HeartPulse aria-hidden="true" />
                        Medical information
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="max-w-prose whitespace-pre-wrap py-3 text-sm">
                      {line.medicalNotes}
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </ItemContent>
              <MarkChoices
                label={"Attendance for " + name}
                value={mark?.status ?? "ABSENT"}
                options={ATTENDANCE_ORDER.map((status) => ({
                  value: status,
                  label: ATTENDANCE_STATUS_META[status].label,
                }))}
                disabled={readOnly || pending}
                onChange={(value) =>
                  set(line.studentId, value as AttendanceStatus)
                }
              />
            </Item>
          );
        })}
      </ItemGroup>
      <div className="flex flex-col gap-2">
        <Label htmlFor="class-note">Class note</Label>
        <Textarea
          id="class-note"
          value={note}
          disabled={readOnly || pending}
          maxLength={300}
          onChange={(event) => {
            const next = event.target.value;
            setNote(next);
            remember(marks, next);
            setDirty(true);
          }}
          rows={2}
          placeholder="Anything the team should know about this class"
        />
      </div>
      {conflict ? (
        <RegisterConflict
          saved={conflict}
          marks={marks}
          note={note}
          lines={lines}
          pending={pending}
          onUseSaved={useSavedRegister}
          onReplace={() => save(conflict.revision)}
        />
      ) : null}
      {error && !conflict ? <TeachingNotice title={error} error /> : null}
      {storageUnavailable && !readOnly ? (
        <TeachingNotice title="This browser cannot keep a backup. Keep this tab open until attendance is saved." />
      ) : null}
      {!readOnly ? (
        <SaveBar
          status={
            restored
              ? "Restored on this device · not saved"
              : dirty
                ? "Not saved yet"
                : lines.some((line) => line.status !== null)
                  ? "Up to date"
                  : "Ready to save"
          }
        >
          <Button
            className="min-h-11"
            disabled={pending || !!conflict}
            onClick={() => save()}
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {pending
              ? "Saving…"
              : continueHref
                ? "Save and continue"
                : "Save attendance"}
            {continueHref && !pending ? (
              <ArrowRight aria-hidden="true" />
            ) : null}
          </Button>
        </SaveBar>
      ) : null}
    </div>
  );
}
