import "server-only";
import { get, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

/** CCTV footage lives in a private Vercel Blob store: videos are far too big
 *  for the database, and a private store serves nothing without its token, so
 *  every viewing goes through Turnfin's own check. The store is connected to
 *  the project in Vercel, which sets BLOB_READ_WRITE_TOKEN; until it is,
 *  requesting footage is switched off and says so. */

export const storageReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** A token that lets the browser upload one video to this one path, of this
 *  type and size at most, until `validUntil`; it can't overwrite anything. */
export function uploadToken(pathname: string, contentType: string, maximumSizeInBytes: number, validUntil: Date) {
  return generateClientTokenFromReadWriteToken({
    pathname, allowedContentTypes: [contentType], maximumSizeInBytes, validUntil: validUntil.getTime(),
    addRandomSuffix: false, allowOverwrite: false,
  });
}

/** What the store holds at a path, or null when the upload never finished. */
export async function stored(pathname: string) {
  try {
    const blob = await head(pathname);
    return { url: blob.url, size: blob.size, contentType: blob.contentType };
  } catch {
    return null;
  }
}

/** The video, or the part of it a player asked for (seeking sends a Range). */
export function read(url: string, range: string | null) {
  return get(url, { access: "private", useCache: false, headers: range ? { range } : undefined });
}
