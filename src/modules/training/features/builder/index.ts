/** The course builder: a course's sections and lessons, its files, preview and
 *  publishing (docs/training.md, e-learning phase 1). Entry for the module and its routes. */
export { CourseBuilder, PublishCourse } from "@/modules/training/features/builder/components/course-builder";
export { CoursePreview } from "@/modules/training/features/builder/components/course-preview";
export { courseForBuilder, draftForPreview } from "@/modules/training/features/builder/server/data";
export { addCourseFile, MAX_FILE_BYTES, readCourseFile, TrainingFileError } from "@/modules/training/features/builder/server/files";
export { fileResponse } from "@/modules/training/shared/files";
export { COURSE_DRAFT_META } from "@/modules/training/shared/constants";
