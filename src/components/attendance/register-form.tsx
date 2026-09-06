"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Tag } from "@/components/ui-kit/tag";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { markRegister } from "@/lib/attendance/actions/register";
import {
  ATTENDANCE_ORDER,
  ATTENDANCE_RECORD_META,
  ATTENDANCE_STATUS_META,
} from "@/lib/attendance/constants";
import type { RegisterLine } from "@/lib/attendance/data/register";
import { ageInYears } from "@/lib/format";
import { parseAttendanceDraft } from "@/lib/attendance/draft";
import { MEDICAL_STATUS_META } from "@/lib/students/constants";
import { SAVE_TIMEOUT_MS, SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import { toast } from "@/lib/toast";
import { Icon } from "@astryxdesign/core/Icon";
import { RegisterConflict } from "@/components/attendance/register-conflict";
import type { SavedRegister } from "@/lib/attendance/revision";

/** The pool-deck screen.
 *
 *  Touch first: nothing is hidden behind hover, the targets are 44px on a
 *  phone, and an unmarked child starts absent, so the instructor ticks who is
 *  in the water. A saved register never says a child was here unless someone
 *  said so; "Everyone in" is the one tap for a full class.
 *
 *  It holds the class in local state behind one Save. That is not a style
 *  choice: Next dispatches Server Actions one at a time per client, so a save
 *  per tap would queue on poolside wifi. Batching also means a dropped
 *  connection leaves the marks in the tab, and the `localStorage` mirror means
 *  they survive the tab being closed. */

/** The mark as a status dot beside the name, so the row reads at a glance
 *  in glare without the buttons having to carry colour. */
const DOT: Record<AttendanceStatus, "success" | "warning" | "error"> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "error",
};

/** The bar pinned to the foot of a deck form: what state the marks are in,
 *  and the one button that saves them. The page scrolls inside the shell's
 *  main region, which has 16px of padding on every side; the bar bleeds
 *  through that padding on three sides and pins 16px past the region's
 *  sticky edge, so it sits flush with the bottom of the screen. Clears the
 *  home indicator on a phone: the bottom padding grows by the safe-area
 *  inset, which is zero everywhere that has none. */
export function SaveBar({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  return (
    <Section
      dividers={["top"]}
      paddingBlock={3}
      className="sticky -mx-4 -mb-4 bottom-[-1rem] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <HStack gap={3} vAlign="center" hAlign="between">
        <Text color="secondary" hasTabularNumbers aria-live="polite" className="min-w-0 flex-1">
          {status}
        </Text>
        <HStack className="shrink-0">{children}</HStack>
      </HStack>
    </Section>
  );
}

type Mark = { status: AttendanceStatus; note: string };

function storageKey(courseId: string, date: string) {
  return `swimly:register:${courseId}:${date}`;
}

export function RegisterForm(props: React.ComponentProps<typeof RegisterFormState>) {
  return <RegisterFormState key={`${props.courseId}:${props.date}:${props.readOnly}`} {...props} />;
}

function RegisterFormState({
  courseId,
  date,
  revision,
  lines,
  classNote,
  readOnly,
  continueHref,
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
  const [baseRevision, setBaseRevision] = React.useState<string | null>(revision);
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

  function remember(next: Map<string, Mark>, nextNote = note, nextRevision = baseRevision) {
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 2, marks: Object.fromEntries(next), note: nextNote, revision: nextRevision }));
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
    for (const [studentId, mark] of marks) next.set(studentId, { ...mark, status });
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
    setMarks(new Map(lines.map(line => [line.studentId,
    conflict.marks[line.studentId] ?? { status: "ABSENT", note: "" },
    ])));
    setNote(conflict.note);
    setBaseRevision(conflict.revision);
    setDirty(false);
    setRestored(false);
    setConflict(null);
    setError(null);
    try { window.localStorage.removeItem(key); } catch { setStorageUnavailable(true); }
    router.refresh();
  }

  const counts = ATTENDANCE_ORDER.map((status) => ({
    status,
    count: [...marks.values()].filter((mark) => mark.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <VStack gap={4}>
      <HStack gap={4} wrap="wrap" vAlign="center" hAlign="between">
        <Text as="p" display="block" color="secondary">
          {counts.map((entry, index) => (
            <React.Fragment key={entry.status}>
              {index > 0 ? ", " : ""}
              <Text weight="medium" color="primary" hasTabularNumbers>
                {entry.count}
              </Text>{" "}
              {ATTENDANCE_STATUS_META[entry.status].label.toLowerCase()}
            </React.Fragment>
          ))}
        </Text>
        {readOnly ? null : (
          <Button
            label="Everyone in"
            variant="secondary"
            size="lg"
            onClick={() => setAll("PRESENT")}
            isDisabled={pending}
          />
        )}
      </HStack>

      <List hasDividers>
        {lines.map((line) => {
          const mark = marks.get(line.studentId);
          const name = `${line.firstName} ${line.lastName}`;
          return (
            <Item
              key={line.studentId}
              as="li"
              align="start"
              label={
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {mark ? (
                    <StatusDot
                      variant={DOT[mark.status]}
                      label={ATTENDANCE_STATUS_META[mark.status].label}
                    />
                  ) : null}
                  <Text type="large" weight="semibold">
                    {name}
                  </Text>
                  {line.offRoster ? (
                    <Tag color={ATTENDANCE_RECORD_META.leftClass.color}>{ATTENDANCE_RECORD_META.leftClass.label}</Tag>
                  ) : null}
                </HStack>
              }
              description={
                <VStack gap={2}>
                  <Text color="secondary">
                    {line.dateOfBirth
                      ? `${ageInYears(line.dateOfBirth)} · `
                      : ""}
                    {line.levelName || "—"}
                  </Text>
                  {line.medicalNotes ? (
                    <Collapsible
                      defaultIsOpen={false}
                      trigger={<Tag color={MEDICAL_STATUS_META.notes.color}>{MEDICAL_STATUS_META.notes.label}</Tag>}
                    >
                      <Text
                        as="p"
                        display="block"
                        className="max-w-prose whitespace-pre-wrap"
                      >
                        {line.medicalNotes}
                      </Text>
                    </Collapsible>
                  ) : null}
                  {/* One of three, all visible: unmarked swimmers default
                      to absent until the instructor records otherwise. */}
                  <HStack>
                    <SegmentedControl
                      label={`Attendance for ${name}`}
                      size="lg"
                      value={mark?.status ?? ""}
                      isDisabled={readOnly || pending}
                      onChange={(value) =>
                        set(line.studentId, value as AttendanceStatus)
                      }
                    >
                      {ATTENDANCE_ORDER.map((status) => (
                        <SegmentedControlItem
                          key={status}
                          value={status}
                          label={ATTENDANCE_STATUS_META[status].label}
                        />
                      ))}
                    </SegmentedControl>
                  </HStack>
                </VStack>
              }
            />
          );
        })}
      </List>

      <TextArea
        label="Anything about the class itself"
        value={note}
        isDisabled={readOnly || pending}
        onChange={(next) => {
          setNote(next);
          remember(marks, next);
          setDirty(true);
        }}
        rows={2}
        placeholder="Pool closed — no class this week"
        width="100%"
      />

      {conflict ? <RegisterConflict saved={conflict} marks={marks} note={note} lines={lines} pending={pending}
        onUseSaved={useSavedRegister} onReplace={() => save(conflict.revision)} /> : null}

      {error && !conflict ? (
        <Banner status="error" title={error} collapsible={false} />
      ) : null}

      {storageUnavailable && !readOnly ? (
        <Banner status="warning" title="This browser cannot keep a backup. Keep this tab open until attendance is saved." collapsible={false} />
      ) : null}

      {readOnly ? null : (
        <SaveBar
          status={
            restored
              ? "Kept on this phone, not saved yet"
              : dirty
                ? "Not saved yet"
                : "Up to date"
          }
        >
          <Button
            label={
              pending
                ? "Saving…"
                : continueHref
                  ? "Save and continue"
                  : "Save attendance"
            }
            variant="primary"
            size="lg"
            onClick={() => save()}
            isLoading={pending}
            isDisabled={!!conflict}
            icon={continueHref ? undefined : <Icon icon={Check} size="sm" />}
            endContent={
              continueHref ? <Icon icon={ArrowRight} size="sm" /> : undefined
            }
          />
        </SaveBar>
      )}
    </VStack>
  );
}
