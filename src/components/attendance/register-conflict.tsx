"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/shadcn/button";
import { TeachingNotice } from "@/components/instructor/teaching-ui";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import type { DraftMark } from "@/lib/attendance/draft";
import type { RegisterLine } from "@/lib/attendance/data/register";
import type { SavedRegister } from "@/lib/attendance/revision";

export function RegisterConflict({
  saved,
  marks,
  note,
  lines,
  pending,
  onUseSaved,
  onReplace,
}: {
  saved: SavedRegister;
  marks: Map<string, DraftMark>;
  note: string;
  lines: RegisterLine[];
  pending: boolean;
  onUseSaved: () => void;
  onReplace: () => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  // The save bar can be far below the roster. Focus the comparison so a
  // keyboard or screen-reader user reaches the recovery choices immediately.
  useEffect(() => {
    region.current?.focus();
  }, []);
  const differences = lines.filter((line) => {
    const mine = marks.get(line.studentId);
    const current = saved.marks[line.studentId];
    return (
      mine &&
      (mine.status !== current?.status || mine.note !== (current?.note ?? ""))
    );
  });
  return (
    <div
      ref={region}
      role="region"
      aria-label="Saved register differences"
      tabIndex={-1}
    >
      <TeachingNotice title="Review the saved attendance">
        <p>
          Your draft has not replaced the saved attendance. Compare the
          differences, then choose which version to keep.
        </p>
        <ul className="w-full divide-y divide-ui-border">
          {differences.map((line) => {
            const mine = marks.get(line.studentId)!,
              current = saved.marks[line.studentId];
            return (
              <li className="space-y-1 py-3" key={line.studentId}>
                <p className="font-semibold text-ui-foreground">
                  {line.firstName} {line.lastName}
                </p>
                <p>
                  Saved:{" "}
                  {current
                    ? ATTENDANCE_STATUS_META[current.status].label
                    : "Not recorded"}
                  . Your draft: {ATTENDANCE_STATUS_META[mine.status].label}.
                </p>
                {mine.note !== (current?.note ?? "") ? (
                  <>
                    <p className="whitespace-pre-wrap">
                      Saved note: {current?.note || "No note"}
                    </p>
                    <p className="whitespace-pre-wrap">
                      Your note: {mine.note || "No note"}
                    </p>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
        {note.trim() !== saved.note ? (
          <div className="space-y-1">
            <p className="font-semibold">Class note</p>
            <p className="whitespace-pre-wrap">
              Saved: {saved.note || "No note"}
            </p>
            <p className="whitespace-pre-wrap">
              Your draft: {note.trim() || "No note"}
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={onUseSaved}>
            Use saved attendance
          </Button>
          <Button disabled={pending} onClick={onReplace}>
            Save my version
          </Button>
        </div>
      </TeachingNotice>
    </div>
  );
}
