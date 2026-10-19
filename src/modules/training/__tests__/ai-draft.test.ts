import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { DRAFT_JSON_SCHEMA, draftSchema, type Draft } from "../features/ai-draft/server/schema";
import { toCourse } from "../features/ai-draft/server/to-course";

/** Drafting a course from a document with AI (docs/training.md): the schema the
 *  API is held to, turning the draft into the builder's lessons and questions,
 *  and the unpublished course it lands as. The AI itself is a double here. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let create: typeof import("../features/ai-draft/server/create");
const ORG = "org_leisureworld";
const state = { id: "maya", permissions: [] as string[] };
const calls: unknown[] = [];

const block = (type: Draft["sections"][number]["lessons"][number]["blocks"][number]["type"], text = "", items: string[] = [], steps: { title: string; text: string }[] = []) => ({ type, text, items, steps });
const DRAFT: Draft = {
  title: "Backwash the sand filters", summary: "How to backwash safely.", category: "Plant room", notes: ["The document doesn’t say how long to rinse.", "Replaced a name with the duty manager."],
  sections: [
    { title: "Before you start", lessons: [
      { kind: "READING", title: "Why we backwash", minutes: 4, cards: [], items: [], blocks: [
        block("paragraph", "Backwashing cleans the sand so the water stays clear."), block("danger", "Never backwash with the chlorine pump running."),
        block("steps", "", [], [{ title: "Tell the duty manager", text: "Before you touch any valve." }, { title: "Stop the pumps", text: "" }]),
      ] },
      { kind: "CHECKLIST", title: "Find the valves", minutes: 3, cards: [], blocks: [block("paragraph", "Tick each one off.")], items: ["Backwash valve", "Rinse valve", ""] },
      { kind: "FLASHCARDS", title: "Too few cards", minutes: 2, blocks: [], items: [], cards: [{ front: "Only one", back: "card" }] },
    ], questions: [
      { kind: "SINGLE", prompt: "What do you do before touching a valve?", explanation: "The SOP says to tell the duty manager first.", options: [{ text: "Tell the duty manager", correct: true }, { text: "Open the rinse valve", correct: false }, { text: "Nothing", correct: false }] },
      { kind: "TRUE_FALSE", prompt: "You can backwash with the chlorine pump running.", explanation: "Never: it can release chlorine gas.", options: [{ text: "True", correct: false }, { text: "False", correct: true }] },
      { kind: "SINGLE", prompt: "No right answer here", explanation: "", options: [{ text: "A", correct: false }, { text: "B", correct: false }] },
    ] },
    { title: "Empty", lessons: [], questions: [] },
  ],
};

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.user.create({ data: { id: "maya", name: "Maya", email: "maya@example.invalid", staffRoleId: "r-staff", orgId: ORG, jobTitle: "" } });
  create = serverModule("src/modules/training/features/ai-draft/server/create.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class extends Error {},
      requireSession: async () => ({ user: { id: state.id, name: "Maya", orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["training"], primaryScreens: ["training"], grants: [], authMethod: "password", authAt: Date.now() } }),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    "@/modules/training/features/ai-draft/server/claude": {
      MODEL: "claude-opus-5-5", DraftError: class extends Error {},
      draftFromDocument: async (source: unknown, options: unknown) => { calls.push({ source, options }); return { draft: DRAFT, name: "backwash-sop.pdf" }; },
    },
  });
});
after(async () => { await fixture?.close(); });

test("the schema the AI is held to closes every object and requires every field", () => {
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: unknown; items?: unknown };
    if (n.type === "object") {
      assert.equal(n.additionalProperties, false);
      assert.deepEqual([...(n.required ?? [])].sort(), Object.keys(n.properties ?? {}).sort());
      Object.values(n.properties ?? {}).forEach(walk);
    }
    if (n.items) walk(n.items);
  };
  walk(DRAFT_JSON_SCHEMA);
  assert.ok(draftSchema.safeParse(DRAFT).success);
});

test("the draft becomes the builder's own lessons and questions, and what doesn't fit is listed", () => {
  const course = toCourse(DRAFT, { practice: true });
  assert.equal(course.sections.length, 1, "an empty section is left out");
  const [section] = course.sections;
  assert.deepEqual(section.lessons.map((l) => l.kind), ["READING", "CHECKLIST", "QUIZ"], "two cards aren't a deck; practice comes last");
  const body = JSON.stringify(section.lessons[0].body);
  assert.match(body, /"stepper"/);
  assert.match(body, /"tone":"danger"/);
  assert.deepEqual(section.lessons[1].data?.items?.map((i) => i.text), ["Backwash valve", "Rinse valve"]);
  assert.equal(section.questions.length, 2);
  assert.deepEqual(section.questions[1].options.map((o) => [o.id, o.correct]), [["true", false], ["false", true]]);
  assert.ok(course.dropped.some((d) => d.includes("Too few cards")));
  assert.ok(course.dropped.some((d) => d.includes("No right answer")));
  assert.equal(toCourse(DRAFT, { practice: false }).sections[0].lessons.some((l) => l.kind === "QUIZ"), false);
});

test("a drafted course lands unpublished, with what to check, and only for authors", async () => {
  state.permissions = ["training.records.read"];
  const refused = await create.draftCourse({ file: null, text: "SOP" }, { title: "", exam: true, practice: true });
  assert.equal(refused.ok, false);
  assert.equal(calls.length, 0, "nothing goes to the AI without the Author level");

  state.permissions = ["training.manage"];
  const made = await create.draftCourse({ file: null, text: "SOP text" }, { title: "", exam: true, practice: true });
  assert.ok(made.ok);
  const course = await fixture.prisma.trainingCourse.findUniqueOrThrow({ where: { id: made.id }, include: { sections: { include: { lessons: true, questions: true } } } });
  assert.equal(course.title, "Backwash the sand filters");
  assert.equal(course.publishedVersionId, null, "never published by the AI");
  assert.equal(course.exam, null, "too few questions for an exam");
  assert.equal(course.sections[0].lessons.length, 3);
  assert.equal(course.sections[0].questions.length, 2);
  const comment = await fixture.prisma.trainingReviewComment.findFirstOrThrow({ where: { courseId: made.id } });
  assert.match(comment.body, /Drafted by AI from backwash-sop\.pdf/);
  assert.match(comment.body, /how long to rinse/);
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entityId: made.id } });
  assert.equal(audit.action, "ai-draft");

  const again = await create.draftCourse({ file: null, text: "SOP text" }, { title: "", exam: false, practice: false });
  assert.ok(again.ok);
  assert.equal((await fixture.prisma.trainingCourse.findUniqueOrThrow({ where: { id: again.id } })).title, "Backwash the sand filters (2)", "a name already taken gets a number");

  for (let i = 0; i < 8; i++) await create.draftCourse({ file: null, text: "SOP" }, { title: `Course ${i}`, exam: false, practice: false });
  const limited = await create.draftCourse({ file: null, text: "SOP" }, { title: "One more", exam: false, practice: false });
  assert.equal(limited.ok, false, "ten an hour");
});
