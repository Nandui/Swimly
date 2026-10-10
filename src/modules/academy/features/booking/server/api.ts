import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { liveSiteById, liveSiteIds, withSites } from "@/lib/directory";
import { formatTime, isDateOnly, parseDateOnly, toDateOnlyString as iso, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sendCode, sendHeld } from "@/modules/academy/features/booking/server/email";
import { AcademyApiError, academyApiConfig, emailSchema, idSchema, notFound, readBody } from "@/modules/academy/features/booking/server/http";
import { bearerToken } from "@/lib/public-api/http";
import {
  ACADEMY_CALL_TIME_KEYS, ACADEMY_CHECKS, ACADEMY_KIND_META, ageOn, bookableOnline, callByFrom, euro, takesPlace, type AcademyCheck, type AcademyKind,
} from "@/modules/academy/shared/rules";

/** The booking site's side of the Academy (owner decision, 8 October 2026; docs/academy.md).
 *
 *  - Anyone can read the courses put online that have not started.
 *  - Holding a place needs an email checked with a code; the check gives a token for an hour.
 *  - A place held online is a candidate with payment owed, `source` online and a deadline to be
 *    phoned (`callBy`, 72 hours). Staff see them on the Academy's "To call" list.
 *
 *  Nothing here returns staff names, other candidates or anything entered by staff. */

const CODE_MS = 10 * 60 * 1000;
const TOKEN_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const digest = (value: string) => createHmac("sha256", academyApiConfig().secret).update(value).digest("hex");

/** Only Vercel's overwritten IP header is trusted; elsewhere one shared bucket. */
function requestIp(request: Request) {
  return process.env.VERCEL === "1" ? (request.headers.get("x-real-ip") ?? "unknown").slice(0, 100) : "anonymous";
}
const tooMany = () => new AcademyApiError(429, "RATE_LIMITED", "Too many attempts. Wait a while and try again.");

/* ---------- Courses ---------- */

const PUBLIC_COURSE = {
  id: true, siteId: true, status: true, capacity: true, priceCents: true, cancelledAt: true, bookOnline: true,
  type: { select: { name: true, kind: true, awardingBody: true, minAge: true, checks: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true, place: true } },
  candidates: { select: { status: true } },
} satisfies Prisma.AcademyCourseSelect;
type PublicRow = Prisma.AcademyCourseGetPayload<{ select: typeof PUBLIC_COURSE }> & { site: { name: string } };

function publicCourse(c: PublicRow) {
  const left = Math.max(0, c.capacity - c.candidates.filter((x) => takesPlace(x.status)).length);
  return {
    id: c.id,
    name: c.type.name,
    kind: c.type.kind,
    kindLabel: ACADEMY_KIND_META[c.type.kind as AcademyKind]?.label ?? "Other",
    awardingBody: c.type.awardingBody,
    minAge: c.type.minAge,
    checks: c.type.checks.filter((k): k is AcademyCheck => k in ACADEMY_CHECKS && k !== "age").map((k) => ACADEMY_CHECKS[k]),
    site: c.site.name,
    priceCents: c.priceCents,
    price: c.priceCents ? euro(c.priceCents) : "Free",
    placesLeft: left,
    firstDay: c.sessions[0] ? iso(c.sessions[0].date) : null,
    lastDay: c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null,
    sessions: c.sessions.map((s) => ({ date: iso(s.date), start: formatTime(s.startMinutes), end: formatTime(s.endMinutes), place: s.place })),
  };
}
export type PublicCourse = ReturnType<typeof publicCourse>;

const onlineWhere = { bookOnline: true, cancelledAt: null, status: "planned" } satisfies Prisma.AcademyCourseWhereInput;

/** Every course open online, soonest first; full ones too, so people can see them. */
export async function courses() {
  const on = today();
  const rows = await withSites(await prisma.academyCourse.findMany({
    where: { ...onlineWhere, siteId: { in: await liveSiteIds() }, sessions: { some: {} }, NOT: { sessions: { some: { date: { lte: parseDateOnly(on) } } } } },
    select: PUBLIC_COURSE, take: 100,
  }), "siteId", "site");
  const list = rows.filter((c) => bookableOnline(c, c.sessions[0] ? iso(c.sessions[0].date) : null, on)).map(publicCourse);
  return { courses: list.sort((a, b) => (a.firstDay ?? "").localeCompare(b.firstDay ?? "")) };
}

async function openCourse(id: string) {
  const row = await prisma.academyCourse.findFirst({ where: { id, ...onlineWhere }, select: PUBLIC_COURSE });
  const site = row ? await liveSiteById(row.siteId) : null;
  if (!row || !site || !bookableOnline(row, row.sessions[0] ? iso(row.sessions[0].date) : null, today())) notFound();
  return { ...row, site: { name: site.name } };
}

export async function course(id: string) {
  return { course: publicCourse(await openCourse(id)) };
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

/** A right code gives a token for an hour. Wrong codes count; five end the check. */
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

/* ---------- Holding a place ---------- */

const phoneSchema = z.string().trim().max(30).refine((v) => /^\+?[\d\s()-]+$/.test(v) && (v.match(/\d/g) ?? []).length >= 7 && (v.match(/\d/g) ?? []).length <= 15,
  "Enter a phone number we can call, like 087 123 4567.");

const bookingSchema = z.object({
  courseId: idSchema,
  name: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  phone: phoneSchema,
  phone2: z.union([z.literal(""), phoneSchema]).default(""),
  dateOfBirth: z.string().refine(isDateOnly, "Enter your date of birth."),
  callTimes: z.array(z.enum(ACADEMY_CALL_TIME_KEYS as [string, ...string[]])).max(3).default([]),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").default(""),
}).strict();

const REFERENCE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newReference = () => `AC-${Array.from({ length: 5 }, () => REFERENCE_LETTERS[randomInt(0, REFERENCE_LETTERS.length)]).join("")}`;

const DAY = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const WHEN = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const words = (f: Intl.DateTimeFormat, d: Date) => {
  const p = (t: string) => f.formatToParts(d).find((x) => x.type === t)?.value ?? "";
  return `${p("weekday")} ${p("day")} ${p("month")}${f === WHEN ? `, ${p("hour")}:${p("minute")}` : ""}`;
};

export async function book(request: Request) {
  const email = await checkedEmail(request);
  const input = await readBody(request, bookingSchema);
  const c = await openCourse(input.courseId);
  const first = c.sessions[0];
  if (input.dateOfBirth > today() || input.dateOfBirth < "1900-01-01") throw new AcademyApiError(400, "INVALID_REQUEST", "Check your date of birth.");
  if (c.type.minAge !== null && ageOn(input.dateOfBirth, iso(first.date)) < c.type.minAge) {
    throw new AcademyApiError(422, "TOO_YOUNG", `You need to be ${c.type.minAge} or over on the first day of the course.`);
  }
  if ((await prisma.academyCandidate.count({ where: { email, source: "online", createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 5) throw tooMany();

  const heldAt = new Date(), callBy = callByFrom(heldAt);
  let reference = "";
  for (let attempt = 0; !reference; attempt++) {
    const candidate = newReference();
    try {
      await prisma.$transaction(async (tx) => {
        // One booking at a time per course, so the last place is never taken twice.
        await tx.$queryRaw`SELECT id FROM "AcademyCourse" WHERE id = ${c.id} FOR UPDATE`;
        const taken = await tx.academyCandidate.findMany({ where: { courseId: c.id }, select: { status: true, email: true } });
        if (taken.some((t) => takesPlace(t.status) && t.email.toLowerCase() === email)) {
          throw new AcademyApiError(409, "ALREADY_BOOKED", "You already have a place on this course. We will phone you about it.");
        }
        if (taken.filter((t) => takesPlace(t.status)).length >= c.capacity) throw new AcademyApiError(409, "FULL", "Sorry, the last place has just gone.");
        const row = await tx.academyCandidate.create({ data: {
          courseId: c.id, name: input.name, email, phone: input.phone, phone2: input.phone2, dateOfBirth: parseDateOnly(input.dateOfBirth),
          payment: "owed", status: "booked", source: "online", reference: candidate, callTimes: input.callTimes, callBy, note: input.note,
          createdByName: "Online booking", createdAt: heldAt,
        } });
        await logAudit({ actorId: null, actorName: `${input.name} (online)`, action: "create", entity: "AcademyCandidate", entityId: row.id, clubId: c.siteId,
          summary: `Held a place online on the ${c.type.name} course (${candidate}); to phone for payment by ${callBy.toISOString()}` }, tx);
      });
      reference = candidate;
    } catch (error) {
      // A reference already taken (unique constraint): try another.
      const clash = (error as { code?: unknown })?.code === "P2002";
      if (!clash || attempt >= 4) throw error;
    }
  }
  const starts = `${words(DAY, first.date)} at ${formatTime(first.startMinutes)}`;
  const price = c.priceCents ? euro(c.priceCents) : "nothing";
  await sendHeld(email, { name: input.name, course: c.type.name, site: c.site.name, starts, reference, phone: input.phone, callBy: words(WHEN, callBy), price });
  return { reference, callBy: callBy.toISOString(), callByLabel: words(WHEN, callBy), phone: input.phone, course: { name: c.type.name, site: c.site.name, starts } };
}
