import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { STUDENT_STATUS_META, ageLabel, fullName } from "@/lib/students/constants";
import type { StudentRow } from "@/lib/students/data/students";
import { swimmerProfileHref } from "@/lib/students/directory";
import styles from "./student-directory.module.css";

/** One link per swimmer, using only the authorized directory projection. */
export function StudentDirectory({ students, returnTo = "/students" }: { students: StudentRow[]; returnTo?: string }) {
  return (
    <div className={styles.directory}>
      <div className={styles.columns} aria-hidden="true">
        <span>Swimmer</span><span>Current level</span><span className={styles.contact}>Contact</span><span>Status</span><span />
      </div>
      <ItemGroup aria-label="Swimmers">
        {students.map((student) => {
          const status = STUDENT_STATUS_META[student.status];
          return (
            <div key={student.id} role="listitem" className={styles.listItem}>
              <Item asChild className={styles.row}>
                <Link href={swimmerProfileHref(student.id, returnTo)} prefetch={false}>
                  <ItemContent className={styles.person}>
                    <ItemTitle className={styles.name}>{fullName(student)}</ItemTitle>
                    <p className={styles.secondary}>
                      {student.memberNumber ? <span>#{student.memberNumber}</span> : <span>No member number</span>}
                      <span aria-hidden="true">·</span>
                      <span>{student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Age not recorded"}</span>
                    </p>
                  </ItemContent>
                  <div className={styles.level}>
                    <span className="sr-only">Current level: </span>
                    {student.placements.length ? student.placements.map((placement) => (
                      <div key={placement.levelId} className={styles.placement}>
                        <span>{placement.levelName}</span>
                        <span className={styles.programme}>{placement.programmeName}</span>
                      </div>
                    )) : <span className="text-ui-muted-foreground">Not enrolled</span>}
                  </div>
                  <div className={styles.contact}>
                    <span className="sr-only">Contact: </span>
                    <p>{student.contactName || "No contact recorded"}</p>
                    {student.contactPhone ? <p className="text-ui-muted-foreground tabular-nums">{student.contactPhone}</p> : null}
                  </div>
                  <div className={styles.status}><Badge variant="secondary" data-tone={status.color}>{status.label}</Badge></div>
                  <ChevronRight className={styles.arrow} aria-hidden="true" />
                  <span className="sr-only">Open profile</span>
                </Link>
              </Item>
            </div>
          );
        })}
      </ItemGroup>
    </div>
  );
}
