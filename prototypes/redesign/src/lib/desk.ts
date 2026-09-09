import { ASSESSMENTS, SWIMMERS } from "./fixtures";
import type { ClubId, DeskCommand, DeskData } from "./types";

export type DeskResult =
  { ok: true; data: DeskData; message: string } | { ok: false; error: string };
export function applyDeskCommand(
  current: DeskData,
  command: DeskCommand,
  clubId: ClubId,
  mayManage: boolean,
): DeskResult {
  if (!mayManage)
    return {
      ok: false,
      error: "You need the enrolment permission to make this change.",
    };
  const swimmer = SWIMMERS.find(
    (row) => row.id === command.swimmerId && row.clubId === clubId,
  );
  if (!swimmer)
    return { ok: false, error: "That swimmer is not in this club." };
  if (!swimmer.active)
    return {
      ok: false,
      error: "This swimmer is inactive. Make them active before booking.",
    };
  const data = structuredClone(current);
  let message: string;
  if (command.type === "assessment") {
    const session = ASSESSMENTS.find(
      (row) => row.id === command.sessionId && row.clubId === clubId,
    );
    if (!session)
      return { ok: false, error: "Choose an assessment session in this club." };
    if (
      data.bookings.some(
        (row) => row.swimmerId === swimmer.id && row.sessionId === session.id,
      )
    )
      return {
        ok: false,
        error: "This swimmer already has a place in that assessment.",
      };
    if (
      data.bookings.filter((row) => row.sessionId === session.id).length >=
      session.capacity
    )
      return {
        ok: false,
        error: "That assessment is now full. Choose another session.",
      };
    data.bookings.push({ swimmerId: swimmer.id, sessionId: session.id });
    message = `${swimmer.name} booked for ${session.date} at ${session.time}.`;
  } else {
    const target = data.classes.find(
      (row) => row.id === command.classId && row.clubId === clubId,
    );
    if (!target) return { ok: false, error: "Choose a class in this club." };
    if (target.swimmerIds.includes(swimmer.id))
      return {
        ok: false,
        error: "This swimmer is already in that class. Choose another class.",
      };
    if (target.swimmerIds.length >= target.capacity)
      return {
        ok: false,
        error: "That class is now full. Choose another class.",
      };
    if (target.level !== swimmer.level && !command.reason?.trim())
      return {
        ok: false,
        error: "Add a placement reason for a different level.",
      };
    if (command.type === "move") {
      const from = data.classes.find(
        (row) =>
          row.id === command.fromClassId &&
          row.clubId === clubId &&
          row.swimmerIds.includes(swimmer.id),
      );
      if (!from)
        return {
          ok: false,
          error:
            "Their current place has changed. Close this form and check their classes.",
        };
      from.swimmerIds = from.swimmerIds.filter((id) => id !== swimmer.id);
    }
    target.swimmerIds.push(swimmer.id);
    message = `${swimmer.name} ${command.type === "move" ? "moved to" : "enrolled in"} ${target.level} at ${target.start}.`;
  }
  data.activity.unshift({
    id: crypto.randomUUID(),
    label: `${message}${"reason" in command && command.reason?.trim() ? ` Placement reason: ${command.reason.trim()}.` : ""}`,
    time: new Date().toISOString(),
  });
  return { ok: true, data, message };
}
