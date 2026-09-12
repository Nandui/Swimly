import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

const records = [
  { id: "one", firstName: "Maya", lastName: "Example", memberNumber: "TEST-101", contactName: "Jordan Sample", contactPhone: "000 123 4567", contactEmail: "jordan@example.test", status: "ACTIVE" },
  { id: "two", firstName: "Noah", lastName: "Sample", memberNumber: "TEST-102", contactName: "Sam Demo", contactPhone: "000 765 4321", contactEmail: "sam@example.test", status: "INACTIVE" },
];
type Where = { status?: string; clubId?: string; AND?: { OR: Record<string, { contains: string }>[] }[] };
function matches(row: typeof records[number], where: Where) {
  return (!where.status || where.status === row.status) && (!where.AND || where.AND.every(term => term.OR.some(branch =>
    Object.entries(branch).every(([key, value]) => String(row[key as keyof typeof row]).toLowerCase().includes(value.contains.toLowerCase())))));
}

test("directory finds full names, reversed names, member numbers and contacts across all statuses and sites", async () => {
  let authorized = false;
  const data = serverModule<typeof import("./students")>("src/lib/students/data/students.ts", {
    "@/lib/authz": { requireSession: async () => { authorized = true; } },
    "@/lib/curriculum/data/shared": { getSharedCurriculum: async () => ({}) },
    "@/lib/prisma": { prisma: { student: {
      count: async ({ where }: { where: Where }) => { assert.ok(authorized); assert.equal(where.clubId, undefined); return records.filter(r => matches(r, where)).length; },
      findMany: async ({ where }: { where: Where }) => records.filter(r => matches(r, where)),
    }, enrolment: { findMany: async () => [] } } },
  });
  for (const q of ["Maya Example", "  EXAMPLE   maya ", "TEST-101", "Jordan Sample", "jordan@example.test", "123 4567"]) {
    assert.deepEqual((await data.getStudents({ q })).students.map(s => s.id), ["one"], q);
  }
  assert.deepEqual((await data.getStudents({ q: "Noah Sample" })).students.map(s => s.id), ["two"]);
  assert.equal((await data.getStudents({ q: "Noah", status: "ACTIVE" })).total, 0);
  assert.equal((await data.getStudents({ q: "Nobody Here" })).total, 0);
});

test("paging is bounded to the available records before a database offset is requested", async () => {
  const offsets: number[] = [];
  const data = serverModule<typeof import("./students")>("src/lib/students/data/students.ts", {
    "@/lib/authz": { requireSession: async () => undefined },
    "@/lib/curriculum/data/shared": { getSharedCurriculum: async () => ({}) },
    "@/lib/prisma": { prisma: { student: {
      count: async () => 205,
      findMany: async ({ skip }: { skip: number }) => { offsets.push(skip); return []; },
    } } },
  });
  for (const page of [Infinity, NaN, -3, 1.5]) assert.equal((await data.getStudents({ page })).page, 1);
  assert.equal((await data.getStudents({ page: 99999 })).page, 3);
  assert.deepEqual(offsets, [0, 0, 0, 0, 200]);
});

test("directory rejects an unauthenticated request before reading curriculum or swimmers", async () => {
  const data = serverModule<typeof import("./students")>("src/lib/students/data/students.ts", {
    "@/lib/authz": { requireSession: async () => { throw Error("Not signed in"); } },
    "@/lib/curriculum/data/shared": { getSharedCurriculum: async () => assert.fail("Unauthenticated curriculum read") },
    "@/lib/prisma": { prisma: {} },
  });
  await assert.rejects(data.getStudents({ q: "Example" }), /Not signed in/);
});
