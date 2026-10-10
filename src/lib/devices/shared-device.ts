import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Shared devices: a reception PC or a poolside tablet used by whoever is on
 *  shift. A browser is marked shared by someone who manages staff; its signed
 *  cookie turns on PIN quick-switch and a short idle sign-out, and revoking
 *  the device ends quick-switch there immediately.
 *
 *  The cookie holds only the device id and an HMAC over it (AUTH_SECRET), so
 *  it cannot be forged or moved to name another device. */

export const DEVICE_COOKIE = "turnfin.device";
/** A shared-device session never lasts longer than this, idle or not. */
export const SHARED_SESSION_MAX_MS = 12 * 60 * 60 * 1000;
export const PIN_MAX_FAILURES = 5;

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required to sign shared-device cookies.");
  return value;
}

export function signDevice(id: string) {
  const mac = createHmac("sha256", secret()).update(`device:${id}`).digest("base64url");
  return `${id}.${mac}`;
}

export function verifyDevice(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const expected = Buffer.from(signDevice(id).slice(dot + 1));
  const given = Buffer.from(value.slice(dot + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

export type SharedDeviceInfo = { id: string; name: string; orgId: string; clubId: string | null };

/** The shared device this browser is, or null. Revoked devices read as none. */
export async function currentSharedDevice(): Promise<SharedDeviceInfo | null> {
  let raw: string | undefined;
  try { raw = (await cookies()).get(DEVICE_COOKIE)?.value; } catch { return null; }
  const id = verifyDevice(raw);
  if (!id) return null;
  const device = await prisma.sharedDevice.findUnique({ where: { id }, select: { id: true, name: true, orgId: true, clubId: true, revokedAt: true } });
  return device && !device.revokedAt ? { id: device.id, name: device.name, orgId: device.orgId, clubId: device.clubId } : null;
}

export const deviceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** PINs are 4 to 8 digits and not an obvious pattern. They only ever unlock a
 *  quick switch on a registered shared device, never a full sign-in. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "Use 4 to 8 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Avoid repeating one digit.";
  const ascending = "0123456789012345", descending = "9876543210987654";
  if (ascending.includes(pin) || descending.includes(pin)) return "Avoid a run of consecutive digits.";
  return null;
}
