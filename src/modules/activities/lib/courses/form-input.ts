import type { CourseInput } from "./actions/courses";

export const UNASSIGNED_INSTRUCTOR = "__unassigned__";

export function readCourseInput(formData: FormData): CourseInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  const instructorId = text("instructorId");
  return {
    levelId: text("levelId"), name: text("name"), dayOfWeek: text("dayOfWeek") as CourseInput["dayOfWeek"],
    startTime: text("startTime"), durationMinutes: text("durationMinutes"), capacity: text("capacity"),
    instructorId: instructorId === UNASSIGNED_INSTRUCTOR ? "" : instructorId, location: text("location"),
  };
}
