import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { operationContext } from "@/lib/operations/context";
import { validOperationToken } from "@/lib/operations/token";
import { expandPermissions } from "@/lib/staff/permissions";
import { AuthorizationError } from "@/lib/authz";
import { createCourse, updateCourse, type CourseInput } from "@/lib/courses/actions/courses";
import { getLevelOptions } from "@/lib/curriculum/data/curriculum";
import { createStudent, updateStudent, type StudentInput } from "@/lib/students/actions/students";
import { enrolStudent, type EnrolInput } from "@/lib/enrolment/actions/enrolment";
import type { ConfirmationReply } from "@/lib/action-result";

export const runtime = "nodejs";
const envelope = z.object({
  operation: z.enum(["check", "levels.list", "courses.list", "students.list", "students.get", "courses.create", "courses.update", "students.create", "students.update", "enrolments.create"]),
  clubId: z.string().max(100).optional(), id: z.string().max(100).optional(),
  query: z.string().max(120).optional(), cursor: z.string().max(100).optional(),
  input: z.unknown().optional(),
  confirmation: z.object({ choice: z.string(), ids: z.array(z.string()).max(100) }).optional(),
}).strict();
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const scope = ["courses.manage", "students.manage", "enrolment.manage"] as const;

export async function POST(request: Request) {
  if (!validOperationToken(request.headers.get("authorization"), process.env.SWIMLY_OPERATIONS_TOKEN_SHA256)) return json({ error: "Unauthorized" }, 401);
  if (request.headers.has("origin")) return json({ error: "Use the command-line client." }, 403);
  const expires = Date.parse(process.env.SWIMLY_OPERATIONS_EXPIRES ?? "");
  if (!Number.isFinite(expires) || expires <= Date.now()) return json({ error: "Operator credential expired." }, 401);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "JSON body required." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); return json({ error: "Request too large." }, 413); }
      chunks.push(value);
    }
    const parsed = envelope.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return json({ error: "Invalid operation request." }, 400);
    const data = parsed.data;
    const actorName = process.env.SWIMLY_OPERATIONS_ACTOR;
    if (!actorName) return json({ error: "Operator not configured." }, 503);
    const actors = await prisma.user.findMany({ where: { name: actorName, isActive: true }, take: 2,
      select: { id: true, name: true, staffRole: { select: { id: true, name: true, permissions: true, home: true, screens: true } } } });
    if (actors.length !== 1 || !actors[0].staffRole) return json({ error: "Operator account unavailable or ambiguous." }, 403);
    const actor = actors[0], role = actor.staffRole!;
    const held = expandPermissions(role.permissions);
    const permissions = scope.filter(p => held.has(p));
    if (!permissions.length) return json({ error: "Operator lacks record-management permissions." }, 403);
    const clubs = await prisma.club.findMany({ where: { archivedAt: null }, select: { id: true, name: true } });
    if (data.operation === "check") return json({ ok: true, actor: { id: actor.id, name: actor.name }, permissions, clubs });
    if (!data.clubId || !clubs.some(c => c.id === data.clubId)) return json({ error: "Choose an existing active club explicitly." }, 400);
    const clubId = data.clubId;
    const session = { user: { id: actor.id, name: `${actor.name} (command line)`, roleId: role.id, roleName: role.name,
      permissions: [...permissions], home: role.home, screens: role.screens }, expires: new Date(expires).toISOString() };
    return await operationContext.run({ session, clubId }, async () => {
      const page = { take: 50, ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}), orderBy: { id: "asc" as const } };
      switch (data.operation) {
        case "levels.list": {
          const levels = (await getLevelOptions()).sort((a, b) => a.id.localeCompare(b.id));
          const start = data.cursor ? levels.findIndex(level => level.id === data.cursor) + 1 : 0;
          return json(levels.slice(start, start + page.take));
        }
        case "courses.list": return json(await prisma.course.findMany({ where: { clubId, ...(data.query ? { name: { contains: data.query, mode: "insensitive" } } : {}) },
          select: { id: true, name: true, levelId: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, capacity: true, instructorId: true, location: true, archivedAt: true,
            enrolments: { where: { status: { in: ["ACTIVE", "WAITLISTED"] } }, select: { studentId: true, status: true } } }, ...page }));
        case "students.list": return json(await prisma.student.findMany({ where: { ...(data.query ? { OR: [
          { memberNumber: { equals: data.query } }, { firstName: { contains: data.query, mode: "insensitive" } }, { lastName: { contains: data.query, mode: "insensitive" } }] } : {}) },
          select: { id: true, memberNumber: true, firstName: true, lastName: true, status: true }, ...page }));
        case "students.get": {
          if (!data.id) return json({ error: "id required" }, 400);
          const student = await prisma.student.findUnique({ where: { id: data.id },
            include: { enrolments: { where: { status: { in: ["ACTIVE", "WAITLISTED"] } } } } });
          return student ? json(student) : json({ error: "Not found" }, 404);
        }
        case "courses.create": return json(await createCourse(data.input as CourseInput));
        case "students.create": return json(await createStudent(data.input as StudentInput));
        case "courses.update": return data.id ? json(await updateCourse(data.id, data.input as CourseInput)) : json({ error: "id required" }, 400);
        case "students.update": return data.id ? json(await updateStudent(data.id, data.input as StudentInput)) : json({ error: "id required" }, 400);
        case "enrolments.create": return json(await enrolStudent(data.input as EnrolInput, data.confirmation as ConfirmationReply | undefined));
        default: return json({ error: "Invalid operation." }, 400);
      }
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ error: "Permission denied." }, 403);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
    return json({ error: "Operation could not be confirmed. Read the record before retrying." }, 500);
  }
}
