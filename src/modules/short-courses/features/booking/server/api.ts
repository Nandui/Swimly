import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bearerToken } from "@/lib/public-api/http";
import { holdSchema } from "@/modules/short-courses/shared/public-booking";
import { academyPublicCourses } from "@/modules/short-courses/features/booking/server/academy";
import { shortCoursePublicCourses } from "@/modules/short-courses/features/booking/server/courses";
import { sendCode, sendHeld } from "@/modules/short-courses/features/booking/server/email";
import { AcademyApiError, academyApiConfig, emailSchema, idSchema, notFound, readBody } from "@/modules/short-courses/features/booking/server/http";

/** The booking site's API (owner decision, 8 October 2026; docs/academy.md): the public see
 *  every course offered online (Academy courses and short courses), check their email with a
 *  code, hold places and see their own bookings.
 *
 *  - Anyone can read the courses put online that have not started.
 *  - Holding a place or seeing your bookings needs an email checked with a code; the check gives
 *    a token for a week (as the parent app's sign-in), ended early by signing out.
 *  - Each kind of course holds its own places (academy.ts, courses.ts; the shape is in
 *    shared/public-booking.ts).
 *
 *  Nothing here returns staff names, other customers or anything entered by staff. */

/** Both kinds of course the site sells: the Academy's qualifications and the weekly courses. */
const SOURCES = [academyPublicCourses, shortCoursePublicCourses];

const CODE_MS = 10 * 60 * 1000;
const TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const digest = (value: string) => createHmac("sha256", academyApiConfig().secret).update(value).digest("hex");

/** Only Vercel's overwritten IP header is trusted; elsewhere one shared bucket. */
function requestIp(request: Request) {
  return process.env.VERCEL === "1" ? (request.headers.get("x-real-ip") ?? "unknown").slice(0, 100) : "anonymous";
}
const tooMany = () => new AcademyApiError(429, "RATE_LIMITED", "Too many attempts. Wait a while and try again.");

/* ---------- Courses, of both kinds ---------- */

/** Every course open online, soonest first; full ones too. */
export async function courses() {
  const lists = await Promise.all(SOURCES.map((source) => source.list()));
  return { courses: lists.flat().sort((a, b) => (a.firstDay ?? "").localeCompare(b.firstDay ?? "")) };
}

/** The source that has this course open online, and the course. Ids are unique across tables. */
async function findCourse(id: string) {
  for (const source of SOURCES) {
    const found = await source.one(id);
    if (found) return { source, course: found };
  }
  notFound();
}

export async function course(id: string) {
  return { course: (await findCourse(id)).course };
}

/* ---------- Checking an email ---------- */

export async function requestCode(request: Request) {
  const { email } = await readBody(request, z.object({ email: emailSchema }).strict());
  const ipHash = digest(`ip:${requestIp(request)}`);
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [byEmail, byIp] = await Promise.all([
    prisma.academyEmailCheck.count({ where: { email, createdAt: { gte: hourAgo } } }),
    prisma.academyEmailCheck.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
  ]);
  if (byEmail >= 5 || byIp >= 30) throw tooMany();
  const id = randomUUID(), code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.academyEmailCheck.create({ data: { id, email, ipHash, codeHash: digest(`code:${id}:${code}`), expiresAt: new Date(Date.now() + CODE_MS) } });
  try {
    await sendCode(email, code);
  } catch (error) {
    // A code that never arrived must never work.
    await prisma.academyEmailCheck.update({ where: { id }, data: { usedAt: new Date() } });
    throw error;
  }
  return { challengeId: id, expiresAt: new Date(Date.now() + CODE_MS).toISOString() };
}

const invalidCode = () => new AcademyApiError(401, "INVALID_CODE", "That code is not right or has expired. Ask for a new one.");

/** A right code gives a token for a week. Wrong codes count; five end the check. */
export async function verifyCode(request: Request) {
  const input = await readBody(request, z.object({ challengeId: idSchema, code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }).strict());
  const check = await prisma.academyEmailCheck.findUnique({ where: { id: input.challengeId } });
  if (!check || check.usedAt || check.expiresAt <= new Date() || check.attempts >= MAX_ATTEMPTS) throw invalidCode();
  if (check.codeHash !== digest(`code:${check.id}:${input.code}`)) {
    await prisma.academyEmailCheck.update({ where: { id: check.id }, data: { attempts: { increment: 1 } } });
    throw invalidCode();
  }
  const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + TOKEN_MS);
  const used = await prisma.academyEmailCheck.updateMany({ where: { id: check.id, usedAt: null }, data: { usedAt: new Date(), tokenHash: digest(`token:${token}`), tokenExpiresAt: expiresAt } });
  if (used.count !== 1) throw invalidCode();
  return { token, email: check.email, expiresAt: expiresAt.toISOString() };
}

/** The checked email behind a token. */
async function checkedEmail(request: Request) {
  const token = bearerToken(request);
  const check = token ? await prisma.academyEmailCheck.findUnique({ where: { tokenHash: digest(`token:${token}`) } }) : null;
  if (!check?.tokenExpiresAt || check.tokenExpiresAt <= new Date()) {
    throw new AcademyApiError(401, "UNAUTHENTICATED", "Your email check has expired. Ask for a new code.");
  }
  return check.email;
}

/** Signing out ends the token at once. */
export async function logout(request: Request) {
  const token = bearerToken(request);
  if (token) await prisma.academyEmailCheck.updateMany({ where: { tokenHash: digest(`token:${token}`) }, data: { tokenExpiresAt: new Date() } });
  return { ok: true };
}

/* ---------- Holding a place, and the customer's own bookings ---------- */

export async function book(request: Request) {
  const email = await checkedEmail(request);
  const input = await readBody(request, holdSchema);
  const { source } = await findCourse(input.courseId);
  const held = await source.hold(email, input);
  await sendHeld(email, { name: input.name, ...held });
  return held;
}

/** Everything booked under the checked email, of either kind: places held online and those the
 *  desk entered with this address. Newest first within each state. */
export async function myBookings(request: Request) {
  const email = await checkedEmail(request);
  const lists = await Promise.all(SOURCES.map((source) => source.bookingsFor(email)));
  const order = { "to-pay": 0, waiting: 1, booked: 2, done: 3, withdrawn: 4, cancelled: 5 } as const;
  const bookings = lists.flat().sort((a, b) => order[a.state] - order[b.state] || (a.firstDay ?? "").localeCompare(b.firstDay ?? ""));
  return { email, bookings };
}
