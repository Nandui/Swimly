import { z } from "zod";

/** The pure rules for CCTV footage requests (docs/incidents.md, "CCTV
 *  footage"), kept apart from the database so they are tested on their own. */

/** How long an emailed link works. Sending it again gives a new link for as long. */
export const LINK_DAYS = 14;
/** Each video can be up to 5 GB, and one request can take up to 10. */
export const MAX_FOOTAGE_BYTES = 5 * 1024 ** 3;
export const MAX_FOOTAGE_FILES = 10;
/** Past this a video goes up in parts, so a dropped connection loses one part, not the lot. */
export const MULTIPART_FROM_BYTES = 50 * 1024 ** 2;
/** How long one upload may run once started (an hour per GB is plenty, but a slow
 *  site uplink and a 5 GB export need the margin). Never past the link's own expiry. */
export const UPLOAD_HOURS = 12;

/** The formats CCTV recorders export, by extension: the common video files,
 *  the recorders' own formats (Dahua .dav, raw H.264), and a zip for an export
 *  that comes with its own player. The type is fixed here, never taken from
 *  the browser, so the store records what the extension says. */
export const FOOTAGE_TYPES: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
  webm: "video/webm", wmv: "video/x-ms-wmv", asf: "video/x-ms-asf", mpg: "video/mpeg", mpeg: "video/mpeg",
  ts: "video/mp2t", mts: "video/mp2t", m2ts: "video/mp2t", "3gp": "video/3gpp",
  dav: "application/octet-stream", "264": "application/octet-stream", h264: "application/octet-stream", zip: "application/zip",
};
export const FOOTAGE_ACCEPT = Object.keys(FOOTAGE_TYPES).map((e) => `.${e}`).join(",");
/** Browsers play these in the page; the rest download to open in a player. */
export const PLAYABLE = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);

export const footageType = (name: string): string | null => FOOTAGE_TYPES[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""] ?? null;

/** A name safe to show and to use in the store's path. */
export const footageName = (name: string) => name.normalize("NFC").replace(/[\x00-\x1f\/\\]/g, "_").trim().slice(0, 200) || "footage";
const pathSafe = (name: string) => name.replace(/\.{2,}/g, ".").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "footage";
/** Each video gets its own path under its request, so no upload can land anywhere else. */
export const footagePath = (requestId: string, footageId: string, name: string) => `incidents/footage/${requestId}/${footageId}-${pathSafe(name)}`;

/** A link's secret is 32 random bytes (server/link.ts), 43 characters in base64url. */
export const tokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export const linkExpiry = (now = new Date()) => new Date(now.getTime() + LINK_DAYS * 86_400_000);

/** Whether a link still takes uploads, and what to tell the person if not. */
export function linkProblem(request: { status: string; expiresAt: Date; report: { status: string } }, now = new Date()): string | null {
  if (request.status === "cancelled") return "This link has been cancelled.";
  if (request.report.status === "closed") return "This request is finished: the report it was for has been closed.";
  if (request.expiresAt <= now) return "This link has expired.";
  return null;
}

/** What can go wrong with a video before it is sent. */
export function footageProblem(file: { name: string; size: number }, received: number): string | null {
  if (!footageType(file.name)) return "That file type isn't accepted. Send the video as exported by the recorder: MP4, MOV, AVI, MKV, DAV, H.264 or a zip.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "That file is empty.";
  if (file.size > MAX_FOOTAGE_BYTES) return "Each video must be no larger than 5 GB. Export a shorter clip, or split it.";
  if (received >= MAX_FOOTAGE_FILES) return `This request already has ${MAX_FOOTAGE_FILES} videos, the most it can take.`;
  return null;
}

const text = (max: number) => z.string().trim().max(max);

export const footageRequestSchema = z.object({
  /** A staff member's id, or empty for someone outside the team. */
  userId: text(64),
  name: text(200),
  email: text(254),
  details: text(2000).min(10, "Say what footage you need: the cameras or place, and the times."),
});
export type FootageRequestInput = z.input<typeof footageRequestSchema>;

export const uploadStartSchema = z.object({
  token: z.string().max(64),
  name: z.string().min(1).max(400),
  size: z.number().int().positive(),
  uploadedBy: text(200).min(2, "Enter your name."),
  note: text(1000),
});
export const uploadDoneSchema = z.object({ token: z.string().max(64), footageId: z.string().min(1).max(40) });

/** The opening lines of the request, filled in from the report: the day, the
 *  time and the place, never who or what. The investigator adds the cameras. */
export function defaultDetails(r: { occurredOn: string; occurredAt: string; area: string; site: string }, day: (iso: string) => string) {
  const [h, m] = r.occurredAt.split(":").map(Number);
  const at = (minutes: number) => {
    const t = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  const when = Number.isFinite(h) && Number.isFinite(m) ? `between ${at(-15)} and ${at(15)}` : "around the time";
  return `CCTV from ${r.area ? `${r.area} at ` : ""}${r.site} on ${day(r.occurredOn)}, ${when}.`;
}

/** Bytes as people read them. */
export const sizeLabel = (bytes: number) =>
  bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
