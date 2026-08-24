import type { AttendanceStatus } from "@/generated/prisma/client";
import { ATTENDANCE_ORDER, ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";

/** The audit summary for a register.
 *
 *  Two rules do the work. **Nothing changed writes nothing** — the existing
 *  rows have to be read to build the diff anyway, so a re-submit or a
 *  did-that-save? re-save costs no log entry, which is what keeps one row per
 *  register from becoming three. And **name the exceptions**: "3 absent" is not
 *  answerable six months later, "3 absent (Ava, Tom, Niamh)" is.
 *
 *  Names are capped because `ActivityTable` renders this in a single row. */
const NAME_CAP = 6;

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= NAME_CAP) return names.join(", ");
  return `${names.slice(0, NAME_CAP).join(", ")} and ${names.length - NAME_CAP} others`;
}

export type Mark = { studentId: string; status: AttendanceStatus };

export type RegisterDescription = {
  action: "attendance";
  amended: boolean;
  summary: string;
};

export function describeRegister(args: {
  classLabel: string;
  dateLabel: string;
  before: ReadonlyMap<string, AttendanceStatus>;
  after: readonly Mark[];
  nameOf: (studentId: string) => string;
}): RegisterDescription | null {
  const { classLabel, dateLabel, before, after, nameOf } = args;

  const changed = after.filter((mark) => before.get(mark.studentId) !== mark.status);
  if (changed.length === 0) return null;

  const amended = before.size > 0;
  const head = `${amended ? "Amended" : "Marked"} the register for ${classLabel} on ${dateLabel}`;

  if (!amended) {
    // First time: the shape of the class, with the exceptions named.
    const parts: string[] = [];
    for (const status of ATTENDANCE_ORDER) {
      const names = after
        .filter((mark) => mark.status === status)
        .map((mark) => nameOf(mark.studentId));
      if (names.length === 0) continue;

      const label = ATTENDANCE_STATUS_META[status].label.toLowerCase();
      parts.push(
        status === "PRESENT"
          ? `${names.length} ${label}`
          : `${names.length} ${label} (${joinNames(names)})`
      );
    }
    return { action: "attendance", amended, summary: `${head} — ${parts.join(", ")}` };
  }

  // An amendment: what actually moved is the interesting part.
  const moves = changed.map((mark) => {
    const from = before.get(mark.studentId);
    const to = ATTENDANCE_STATUS_META[mark.status].label.toLowerCase();
    const name = nameOf(mark.studentId);
    return from
      ? `${name} ${ATTENDANCE_STATUS_META[from].label.toLowerCase()} → ${to}`
      : `${name} ${to}`;
  });

  const shown =
    moves.length <= NAME_CAP
      ? moves.join(", ")
      : `${moves.slice(0, NAME_CAP).join(", ")} and ${moves.length - NAME_CAP} others`;

  return { action: "attendance", amended, summary: `${head} — ${shown}` };
}
