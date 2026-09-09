"use client";

import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { Heading } from "@/components/workspace/typography";
import { Icon } from "@/components/workspace/misc";
import { Link } from "@/components/workspace/typography";
import { List, ListItem } from "@/components/workspace/layout";
import { HStack, VStack } from "@/components/workspace/layout";
import { Text } from "@/components/workspace/typography";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { STUDENT_STATUS_META, ageLabel, fullName } from "@/lib/students/constants";
import type { StudentRow } from "@/lib/students/data/students";
import styles from "./student-directory.module.css";

/** Selection uses the already-authorized list data; opening a preview needs no
 * extra request and never fetches the profile's medical or private notes. */
export function StudentDirectory({
  students,
  pagination,
}: {
  students: StudentRow[];
  pagination?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(students[0]?.id);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useRef<HTMLElement>(null);
  const selectedRow = useRef<HTMLElement | null>(null);
  const student = students.find((row) => row.id === selectedId) ?? students[0];
  if (!student) return null;

  const meta = STUDENT_STATUS_META[student.status];

  function select(id: string, target: HTMLElement) {
    selectedRow.current = target.closest("li")?.querySelector("button") ?? target;
    setSelectedId(id);
    setShowPreview(true);
    // On narrow screens the list is replaced by the preview. Move focus with
    // it; on desktop keep focus in the list for quick keyboard scanning.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => preview.current?.focus());
    }
  }

  function backToList() {
    setShowPreview(false);
    requestAnimationFrame(() => selectedRow.current?.focus());
  }

  return (
    <div className={styles.directory} data-preview={showPreview}>
      <div className={styles.roster}>
        <div className={styles.scroll}>
          <List
            header={<span className="sr-only">Swimmers — select a swimmer to preview their profile</span>}
            density="spacious"
            hasDividers
          >
            {students.map((row) => {
              const status = STUDENT_STATUS_META[row.status];
              const levels = row.placements.map((placement) => placement.levelName).join(", ");
              return (
                <ListItem
                  key={row.id}
                  className="min-h-22"
                  label={<Text weight="medium"><span className="sr-only">Preview </span>{fullName(row)}</Text>}
                  description={
                    <Text type="supporting" className="break-words">
                      {row.dateOfBirth ? `Age ${ageLabel(row.dateOfBirth)} · ` : ""}
                      {levels || "Not placed"}
                      {row.memberNumber ? <span className="sr-only"> · {row.memberNumber}</span> : null}
                    </Text>
                  }
                  startContent={<Avatar name={fullName(row)} size="lg" tooltip={false} />}
                  endContent={
                    <HStack gap={2} vAlign="center">
                      <Tag color={status.color}>{status.label}</Tag>
                      <Icon icon={ChevronRight} size="sm" />
                    </HStack>
                  }
                  isSelected={row.id === student.id}
                  onClick={(event) => select(row.id, event.currentTarget as HTMLElement)}
                />
              );
            })}
          </List>
        </div>
        {pagination ? <div className="pt-4">{pagination}</div> : null}
      </div>

      <section
        ref={preview}
        tabIndex={-1}
        aria-label={`${fullName(student)} — profile preview`}
        className={styles.preview}
      >
        <VStack gap={6}>
          <div className="lg:hidden">
            <Button label="Back to swimmers" variant="ghost" icon={<Icon icon={ArrowLeft} />} onClick={backToList} />
          </div>
          <VStack gap={2}>
            <Heading level={2} className="break-words">{fullName(student)}</Heading>
            <div><Tag color={meta.color}>{meta.label}</Tag></div>
          </VStack>
          <dl className={styles.facts}>
            <Detail label="Member number">{student.memberNumber || "Not assigned"}</Detail>
            <Detail label="Age">{student.dateOfBirth ? `${ageLabel(student.dateOfBirth)} years` : "Date of birth not recorded"}</Detail>
            <Detail label={student.placements.length > 1 ? "Current levels" : "Current level"}>
              {student.placements.length ? (
                <VStack gap={2}>
                  {student.placements.map((placement) => (
                    <VStack key={placement.programmeId} gap={1}>
                      <Text>{placement.levelName}</Text>
                      <Text type="supporting">{placement.programmeName}</Text>
                    </VStack>
                  ))}
                </VStack>
              ) : "Not placed"}
            </Detail>
            <Detail label="Contact">
              <VStack gap={1}>
                <Text>{student.contactName || "No contact name recorded"}</Text>
                {student.contactPhone ? (
                  <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center">
                    {student.contactPhone}
                  </Link>
                ) : <Text type="supporting">No phone number recorded</Text>}
              </VStack>
            </Detail>
          </dl>
          <div className="border-t border-border pt-5">
            <Button href={`/students/${student.id}`} label="Open full profile" variant="secondary" />
          </div>
        </VStack>
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt><Text type="supporting">{label}</Text></dt>
      <dd className="mt-1 break-words">{typeof children === "string" ? <Text>{children}</Text> : children}</dd>
    </div>
  );
}
