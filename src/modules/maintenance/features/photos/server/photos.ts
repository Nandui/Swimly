import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { fileProblem, safeFileName } from "@/lib/files";
import { siteName } from "@/lib/directory";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import type { MaintenanceActor } from "@/modules/maintenance/shared/access";
import { isOpen, MaintenanceError } from "@/modules/maintenance/shared/rules";
import { lockRequest, recordStep } from "@/modules/maintenance/shared/service";
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from "@/modules/maintenance/shared/types";

/** Photos of the problem, kept in the database beside the request like refund receipts. The
 *  reporter adds them to their own open request, and Manage to any open request at the site.
 *  Each is checked by the platform's file check, then turned upright, shrunk to at most 2000px and
 *  kept as WebP without camera details (no location). Anyone who sees the request sees them. */

const RULE = { kinds: ["photo"] as const, maxBytes: MAX_PHOTO_BYTES };

async function rights(who: MaintenanceActor, row: { siteId: string; reportedById: string; status: string }) {
  if (!(await mayFor("maintenance.report", { siteId: row.siteId, orgId: who.orgId }))) return null;
  const manage = who.manage && await mayFor("maintenance.manage", { siteId: row.siteId, orgId: who.orgId });
  return { change: isOpen(row.status) && (row.reportedById === who.id || manage) };
}

/** The photo as kept: upright, at most 2000px on its longer side, WebP, no metadata. */
export async function keptPhoto(bytes: Uint8Array) {
  return new Uint8Array(await sharp(bytes).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer());
}

export async function addPhoto(who: MaintenanceActor, requestId: string, file: File) {
  const row = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, orgId: who.orgId ?? undefined } });
  const may = row && await rights(who, row);
  if (!row || !may) throw new MaintenanceError("This request is not available.");
  if (!may.change) throw new MaintenanceError("Photos can be added only while the request is open, by whoever reported it or a manager at the site.");
  const bytes = file.size > MAX_PHOTO_BYTES ? new Uint8Array() : new Uint8Array(await file.arrayBuffer());
  const problem = fileProblem(file, bytes, RULE);
  if (problem) throw new MaintenanceError(problem);
  let kept: Uint8Array;
  try { kept = await keptPhoto(bytes); } catch { throw new MaintenanceError("That photo could not be opened. Take it again or choose another."); }
  const name = `${safeFileName(file.name).replace(/\.[^.]*$/, "")}.webp`;
  const site = await siteName(row.siteId);
  await prisma.$transaction(async (tx) => {
    await lockRequest(tx, requestId);
    const now = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (!isOpen(now.status)) throw new MaintenanceError("This request was closed meanwhile. Refresh the page.");
    if (await tx.maintenancePhoto.count({ where: { requestId, removedAt: null } }) >= MAX_PHOTOS) throw new MaintenanceError(`A request can have up to ${MAX_PHOTOS} photos.`);
    await tx.maintenancePhoto.create({ data: { id: randomUUID(), orgId: now.orgId, requestId, name, mime: "image/webp", size: kept.length, bytes: Buffer.from(kept), addedById: who.id, addedByName: who.name } });
    await recordStep(tx, now, who, "photo_add", randomUUID(), name, site);
  });
}

/** Hidden, not deleted: the history keeps that it was there. */
export async function removePhoto(who: MaintenanceActor, photoId: string) {
  const photo = await prisma.maintenancePhoto.findFirst({ where: { id: photoId, orgId: who.orgId ?? undefined, removedAt: null }, include: { request: true } });
  const may = photo && await rights(who, photo.request);
  if (!photo || !may) throw new MaintenanceError("This photo is no longer there.");
  if (!may.change) throw new MaintenanceError("Photos can be removed only while the request is open, by whoever reported it or a manager at the site.");
  const site = await siteName(photo.request.siteId);
  await prisma.$transaction(async (tx) => {
    await lockRequest(tx, photo.requestId);
    const { count } = await tx.maintenancePhoto.updateMany({ where: { id: photoId, removedAt: null }, data: { removedAt: new Date() } });
    if (!count) throw new MaintenanceError("This photo is no longer there.");
    await recordStep(tx, photo.request, who, "photo_remove", randomUUID(), photo.name, site);
  });
}

/** One photo for someone who may see its request. */
export async function readPhoto(who: MaintenanceActor, photoId: string) {
  const photo = await prisma.maintenancePhoto.findFirst({ where: { id: photoId, orgId: who.orgId ?? undefined, removedAt: null }, include: { request: { select: { siteId: true, reportedById: true, status: true } } } });
  if (!photo || !(await rights(who, photo.request))) throw new MaintenanceError("This photo is not available.");
  return { name: photo.name, mime: photo.mime, size: photo.size, bytes: photo.bytes };
}
