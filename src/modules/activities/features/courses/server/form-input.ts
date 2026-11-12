import type { CourseInput } from "@/modules/activities/features/courses/server/actions/courses";

export function readCourseInput(formData: FormData): CourseInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    levelId: text("levelId"), name: text("name"), dayOfWeek: text("dayOfWeek") as CourseInput["dayOfWeek"],
    startTime: text("startTime"), durationMinutes: text("durationMinutes"), capacity: text("capacity"),
    location: text("location"),
  };
}
