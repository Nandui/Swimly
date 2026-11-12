/** Task templates: what a task asks for and when it repeats. Entry for the
 *  module and its routes. */
export { ArchiveTemplate, CopyTemplate } from "@/modules/tasks/features/templates/components/template-actions";
export { TemplateEditor } from "@/modules/tasks/features/templates/components/template-editor";
export { taskTemplate, taskTemplates } from "@/modules/tasks/features/templates/server/data";
export { scheduleLabel, TEMPLATE_KIND_SHORT, TEMPLATE_STATUS_META, type TemplateStatus } from "@/modules/tasks/shared/rules";
