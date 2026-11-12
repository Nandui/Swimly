/** Photos and documents on a report. Entry for the module and its routes. */
export { FilesPanel } from "@/modules/incidents/features/files/components/files-panel";
export { addFile, MAX_FILE_BYTES, readFile } from "@/modules/incidents/features/files/server/files";
export { IncidentError } from "@/modules/incidents/shared/rules";
export { requireIncidentsActor } from "@/modules/incidents/shared/access";
