import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { STUDENT_STATUS_META, ageLabel, fullName } from "@/modules/activities/shared/students/constants";
import type { StudentRow } from "@/modules/activities/features/students/server/data/students";
import { swimmerProfileHref } from "@/modules/activities/features/students/server/directory";
import styles from "@/modules/activities/features/students/components/student-directory.module.css";

/** One link per swimmer, using only the authorized directory projection. */
export function StudentDirectory({ students, returnTo = "/students" }: { students: StudentRow[]; returnTo?: string }) {
  return (
    <div className={styles.directory}>
      <div className={styles.columns} aria-hidden="true">
        <span>Swimmer</span><span>Current level</span><span className={styles.site}>Site</span><span>Status</span><span />
      </div>
      <ItemGroup aria-label="Swimmers">
        {students.map((student) => {
          const status = STUDENT_STATUS_META[student.status];
          const hint = [
            student.memberNumber ? `#${student.memberNumber}` : null,
            student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Age not recorded",
          ].filter(Boolean).join(" · ");
          return (
            <div key={student.id} role="listitem">
              <Item asChild className={styles.row}>
                <Link href={swimmerProfileHref(student.id, returnTo)} prefetch={false} data-motion="link">
                  <ItemContent className={styles.person}>
                    <Avatar size="lg" aria-hidden="true">
                      <AvatarFallback>{`${student.firstName.charAt(0)}${student.lastName.charAt(0)}`}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <ItemTitle className={styles.name}>{fullName(student)}</ItemTitle>
                      <p className="pc-row-hint">{hint}</p>
                    </div>
                  </ItemContent>
                  <div className={styles.level}>
                    <span className="sr-only">Current level: </span>
                    {student.placements.length ? student.placements.map((placement) => (
                      <div key={placement.levelId} className={styles.placement}>
                        <span>{placement.levelName}</span>
                        <span className={styles.programme}>{placement.programmeName}</span>
                      </div>
                    )) : <span className={styles.muted}>Not enrolled</span>}
                  </div>
                  <div className={styles.site}>
                    <span className="sr-only">Site: </span>{student.club.name}
                  </div>
                  <div className={styles.status}><Tag meta={status} /></div>
                  <span className={styles.arrow} data-motion="direction" aria-hidden="true"><ChevronRight className="size-full" /></span>
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
