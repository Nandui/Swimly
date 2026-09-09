"use client";

import { useEffect, useRef } from "react";
import { Banner } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { Item } from "@/components/workspace/layout";
import { List } from "@/components/workspace/layout";
import { HStack, VStack } from "@/components/workspace/layout";
import { Text } from "@/components/workspace/typography";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import type { DraftMark } from "@/lib/attendance/draft";
import type { RegisterLine } from "@/lib/attendance/data/register";
import type { SavedRegister } from "@/lib/attendance/revision";

export function RegisterConflict({ saved, marks, note, lines, pending, onUseSaved, onReplace }: {
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
  useEffect(() => { region.current?.focus(); }, []);
  const differences = lines.filter(line => {
    const mine = marks.get(line.studentId);
    const current = saved.marks[line.studentId];
    return mine && (mine.status !== current?.status || mine.note !== (current?.note ?? ""));
  });
  return (
    <div ref={region} role="region" aria-label="Saved register differences" tabIndex={-1}>
      <Banner status="warning" title="Review the saved register" collapsible={false}
        description="Your draft has not replaced the saved register. Compare the differences, then choose which version to keep.">
        <VStack gap={3}>
          <List hasDividers>
            {differences.map(line => {
              const mine = marks.get(line.studentId)!;
              const current = saved.marks[line.studentId];
              return <Item key={line.studentId} as="li" label={`${line.firstName} ${line.lastName}`} description={
                <VStack gap={1}>
                  <Text>Saved: {current ? ATTENDANCE_STATUS_META[current.status].label : "Not recorded"}. Your draft: {ATTENDANCE_STATUS_META[mine.status].label}.</Text>
                  {mine.note !== (current?.note ?? "") ? <>
                    <Text className="whitespace-pre-wrap">Saved note: {current?.note || "No note"}</Text>
                    <Text className="whitespace-pre-wrap">Your note: {mine.note || "No note"}</Text>
                  </> : null}
                </VStack>
              } />;
            })}
          </List>
          {note.trim() !== saved.note ? <VStack gap={1}>
            <Text weight="semibold">Class note</Text>
            <Text className="whitespace-pre-wrap">Saved: {saved.note || "No note"}</Text>
            <Text className="whitespace-pre-wrap">Your draft: {note.trim() || "No note"}</Text>
          </VStack> : null}
          <Text color="secondary">Use the saved register to discard your draft, or save your version to replace the values shown above.</Text>
          <HStack gap={2} wrap="wrap">
            <Button label="Use saved register" variant="secondary" isDisabled={pending} onClick={onUseSaved} />
            <Button label="Save my version" variant="primary" isDisabled={pending} onClick={onReplace} />
          </HStack>
        </VStack>
      </Banner>
    </div>
  );
}
