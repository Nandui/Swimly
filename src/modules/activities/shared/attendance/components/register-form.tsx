"use client";
import { Tag } from "@/components/ui-kit/tag";
import { MEDICAL_STATUS_META, ageLabel } from "@/modules/activities/shared/students/constants";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ChevronRight, Clock3, HeartPulse, X } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Inspector } from "@/components/ui-kit/inspector";
import { Notice } from "@/components/ui-kit/notice";
import { ProgressRing } from "@/components/ui-kit/progress-ring";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { markRegister } from "@/modules/activities/shared/attendance/actions/register";
import { ATTENDANCE_STATUS_META } from "@/modules/activities/shared/attendance/constants";
import type { RegisterLine } from "@/modules/activities/shared/attendance/data/register";
import { parseAttendanceDraft, type DraftMark } from "@/modules/activities/shared/attendance/draft";
import { nextMark, registerCount, type Marking } from "@/modules/activities/shared/attendance/marking";
import {
  SAVE_TIMEOUT_MS,
  SAVE_UNCONFIRMED_MESSAGE,
  withTimeout,
} from "@/lib/save-feedback";
import { toast } from "@/components/ui/toast";
import { RegisterConflict } from "@/modules/activities/shared/attendance/components/register-conflict";
import type { SavedRegister } from "@/modules/activities/shared/attendance/revision";

export function SaveBar({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  // A panel of its own after the main one; kit.css (.pc-save-bar) holds it above the
  // viewport's edge, or above the bottom bar where the frame shows one.
  return (
    <div className="pc-panel pc-save-bar">
      <p
        role="status"
        aria-live="polite"
        className="min-w-0 flex-1 font-semibold"
      >
        {status}
      </p>
      {children}
    </div>
  );
}

type Mark = { status: Marking; note: string };

/** The symbol inside a swimmer's DoneMark: a tick for present, a clock for late, a cross for absent. */
const MARK_ICON = { PRESENT: Check, LATE: Clock3, ABSENT: X } as const;

function storageKey(courseId: string, date: string) {
  return `swimly:register:${courseId}:${date}`;
}

/** Only the swimmers someone has marked: what a draft keeps and a save sends. */
function markedOnly(marks: Map<string, Mark>) {
  const out = new Map<string, DraftMark>();
  for (const [studentId, mark] of marks) if (mark.status) out.set(studentId, { status: mark.status, note: mark.note });
  return out;
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

/** The register, as the approved Turnfin Glass canvas draws it (DESIGN.md, The pool deck): a
 *  green ring with how many are here, how the marks stand and "All here"; then each swimmer as a
 *  64px row that is one target: one tap marks them here, a second away, a third late, always with
 *  the word beside the mark. A swimmer nobody has marked yet stays unmarked, and the save button
 *  reads "4 still to mark" until everyone is. Medical notes stay off the list: a row only says a
 *  swimmer has some, and the notes this person may read open together from the button above it.
 *  The marks are mirrored on the device until they are saved. */
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
        status: line.status ?? null,
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
  const [medicalOpen, setMedicalOpen] = React.useState(false);

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
          marks: Object.fromEntries(markedOnly(next)),
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
            marks: [...markedOnly(marks).entries()].map(([studentId, mark]) => ({
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
        toast.success("Register saved");
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
          conflict.marks[line.studentId] ?? { status: null, note: "" },
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

  const count = registerCount([...marks.values()].map((mark) => mark.status));
  const tally = (["PRESENT", "LATE", "ABSENT"] as const)
    .map((status) => ({ status, n: [...marks.values()].filter((mark) => mark.status === status).length }))
    .filter((entry) => entry.n > 0)
    .map((entry) => `${entry.n} ${ATTENDANCE_STATUS_META[entry.status].label.toLowerCase()}`);
  const medical = lines.filter((line) => line.medicalNotes);
  const saved = !dirty && lines.length > 0 && lines.every((line) => line.status !== null);
  const saveLabel = count.toMark
    ? `${count.toMark} still to mark`
    : continueHref
      ? "Save and continue"
      : saved
        ? "Saved"
        : "Save register";

  return (
    <>
    <section className="flex min-w-0 flex-col gap-(--space-5)" aria-labelledby="register-h">
      <div className="pc-panel reg-head">
        <ProgressRing value={count.here} max={count.total} label={`${count.here} of ${count.total} swimmers here`}>
          <span className="reg-ring-n">{count.here}</span>
          <span className="reg-ring-of">of {count.total} here</span>
        </ProgressRing>
        <div className="reg-head-body">
          <h2 id="register-h">Register</h2>
          <p className="font-semibold" aria-live="polite">{tally.length ? tally.join(" · ") : "Nobody marked yet"}</p>
          <p className="text-footnote text-(--label-2)">
            {readOnly ? "This register is read only." : "Tap a swimmer once for here, twice for away, three times for late."}
          </p>
        </div>
        {!readOnly ? (
          <Button variant="outline" onClick={() => setAll("PRESENT")} disabled={pending}>
            <CheckCheck aria-hidden="true" />
            All here
          </Button>
        ) : null}
      </div>
      {medical.length ? (
        <Button variant="outline" className="self-start" onClick={() => setMedicalOpen(true)}>
          <HeartPulse aria-hidden="true" />
          Medical notes · {medical.length === 1 ? "1 swimmer" : `${medical.length} swimmers`}
        </Button>
      ) : null}
      <ul className="pc-list reg-list">
        {lines.map((line) => {
          const status = marks.get(line.studentId)?.status ?? null,
            name = line.firstName + " " + line.lastName,
            meta = status ? ATTENDANCE_STATUS_META[status] : null,
            MarkIcon = status ? MARK_ICON[status] : null;
          const hint = [
            line.dateOfBirth ? `Age ${ageLabel(line.dateOfBirth)}` : null,
            line.levelName || null,
            line.offRoster ? "No longer in this class" : null,
          ].filter(Boolean).join(" · ");
          const body = (
            <>
              <Avatar size="lg" aria-hidden="true"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
              <span className="pc-row-body">
                <span className="reg-name">{name}</span>
                {hint ? <span className="pc-row-hint">{hint}</span> : null}
                {line.medicalNotes || line.hasMedicalNotes ? <span className="reg-flags"><Tag meta={MEDICAL_STATUS_META.notes} /></span> : null}
              </span>
              <span className="reg-mark" data-status={status ?? "none"}>
                <span className="reg-mark-word">{meta?.label ?? "To mark"}</span>
                <span className="done-mark" data-status={status ?? "none"} aria-hidden="true">{MarkIcon ? <MarkIcon /> : null}</span>
              </span>
            </>
          );
          return (
            <li key={line.studentId}>
              {readOnly ? (
                <div className="pc-row reg-row">{body}</div>
              ) : (
                <Button type="button" variant="ghost" className="pc-row reg-row" disabled={pending}
                  aria-label={`${name}: ${meta?.label ?? "not marked"}. Tap to mark ${ATTENDANCE_STATUS_META[nextMark(status)].label.toLowerCase()}`}
                  onClick={() => set(line.studentId, nextMark(status))}>
                  {body}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="pc-panel">
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
          marks={markedOnly(marks)}
          note={note}
          lines={lines}
          pending={pending}
          onUseSaved={useSavedRegister}
          onReplace={() => save(conflict.revision)}
        />
      ) : null}
      {error && !conflict ? <Notice tone="error" live="alert" title={error} /> : null}
      {storageUnavailable && !readOnly ? (
        <Notice tone="warning" title="This browser cannot keep a backup. Keep this tab open until attendance is saved." />
      ) : null}
    </section>
    {medical.length ? (
      <Inspector open={medicalOpen} onOpenChange={setMedicalOpen} title="Medical notes"
        description="For the swimmers in this class. Each swimmer's full record has the rest.">
        <ul className="pc-list">
          {medical.map((line) => (
            <li key={line.studentId} className="pc-row reg-medical">
              <span className="reg-name">{line.firstName} {line.lastName}</span>
              <span className="whitespace-pre-wrap">{line.medicalNotes}</span>
            </li>
          ))}
        </ul>
      </Inspector>
    ) : null}
    {!readOnly ? (
      <SaveBar
        status={
          restored
            ? "Restored on this device · not saved"
            : dirty
              ? "Not saved yet"
              : saved
                ? "Up to date"
                : "Ready to mark"
        }
      >
        <LoadingButton
          pending={pending}
          disabled={!!conflict || count.toMark > 0 || (saved && !continueHref)}
          onClick={() => save()}
        >
          {count.toMark ? null : <Check aria-hidden="true" />}
          {saveLabel}
          {continueHref && !count.toMark ? (
            <ChevronRight aria-hidden="true" />
          ) : null}
        </LoadingButton>
      </SaveBar>
    ) : null}
    </>
  );
}
