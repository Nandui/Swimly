/** CCTV footage requests: asking whoever holds the recording by email, the
 *  link's upload page, and watching what arrived. Entry for the module and its
 *  routes. */
export { FootagePanel } from "@/modules/incidents/features/footage/components/footage-panel";
export { FootageLinkClosed, UploadFootage } from "@/modules/incidents/features/footage/components/upload-footage";
export { footageOnReport, footageToWatch, logWatch } from "@/modules/incidents/features/footage/server/requests";
export { finishUpload, footageLink, startUpload } from "@/modules/incidents/features/footage/server/uploads";
export { sendFootageReceived } from "@/modules/incidents/features/footage/server/emails";
export { read as readFootage } from "@/modules/incidents/features/footage/server/storage";
export { PLAYABLE } from "@/modules/incidents/features/footage/rules";
export { IncidentError } from "@/modules/incidents/shared/rules";
export { requireIncidentsActor } from "@/modules/incidents/shared/access";
export { requestOrigin } from "@/modules/incidents/shared/origin";
