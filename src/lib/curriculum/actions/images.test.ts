import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

for (const kind of ["programme", "level"] as const) {
  function fixture() {
    const state = { row: { id: "record", name: "Sample", description: null as string | null, imageVersion: "old" as string | null,
      imageData: new Uint8Array([1]) as Uint8Array | null, programmeId: "programme", programme: { name: "Programme" } },
      allowed: true, missing: false, auditFails: false, writes: 0, prepared: 0, scopes: [] as unknown[], audits: [] as string[], invalidated: [] as string[] };
    const tx = { [kind]: { update: async (args: { where: unknown; data: object }) => {
      state.scopes.push(args.where); state.writes++; Object.assign(state.row, args.data); return state.row;
    }, create: async (args: { data: object }) => { state.writes++; Object.assign(state.row, args.data); return state.row; } } };
    const db = { [kind]: { findUnique: async (args: { where: unknown }) => { state.scopes.push(args.where); return state.missing ? null : { ...state.row }; }, findFirst: async () => null },
      ...(kind === "level" ? { programme: { findUnique: async () => ({ id: "programme", name: "Programme", archivedAt: null }) } } : {}),
      $transaction: async (work: (client: typeof tx) => Promise<unknown>) => {
        const before = { ...state.row };
        try { return await work(tx); } catch (error) { state.row = before; throw error; }
      } };
    const actions = serverModule<Record<string, (...args: unknown[]) => Promise<{ ok: boolean }>>>(`src/lib/curriculum/actions/${kind}s.ts`, {
      "@/lib/authz": { requirePermission: async (permission: string) => { assert.equal(permission, "curriculum.manage"); if (!state.allowed) throw Error("denied"); return { user: { id: "staff", name: "Staff" } }; } },
      "@/lib/clubs/current": { currentClubId: async () => "club" },
      "@/lib/curriculum/data/shared": { readSharedCurriculum: async () => ({ programmeIds: { resolve: (id: string) => id, variants: (id: string) => [id] }, levelIds: { resolve: (id: string) => id } }) },
      "@/lib/curriculum/shared-name": { sharedNameTaken: async () => false },
      "@/lib/prisma": { prisma: db },
      "@/lib/audit": { logAudit: async (entry: { summary: string }, client: unknown) => { assert.equal(client, tx); if (state.auditFails) throw Error("audit failed"); state.audits.push(entry.summary); } },
      "next/cache": { revalidatePath: (path: string) => state.invalidated.push(path) },
      "@/lib/curriculum/image-upload": { prepareImage: async (form?: FormData) => {
        state.prepared++;
        return { ok: true, data: !form ? {} : form.get("removeImage") === "true" ? { imageData: null, imageVersion: null } : { imageData: new Uint8Array([2]), imageVersion: "new" } };
      } },
    });
    const update = (form?: FormData, name = "Sample") => actions[kind === "programme" ? "updateProgramme" : "updateLevel"]("record", { name, description: "" }, form);
    const create = (form: FormData) => kind === "programme" ? actions.createProgramme({ name: "New", description: "" }, form) : actions.createLevel("programme", { name: "New", description: "" }, form);
    return { state, update, create };
  }

  test(`${kind} creates and replaces images with an audit, preserves them on text edits and removes explicitly`, async () => {
    const f = fixture();
    assert.equal((await f.create(new FormData())).ok, true);
    assert.match(f.state.audits[0], /with an image/);
    f.state.row.name = "Sample"; f.state.row.imageVersion = "old";
    assert.equal((await f.update(new FormData())).ok, true);
    assert.equal(f.state.row.imageVersion, "new");
    assert.match(f.state.audits.at(-1)!, /image added or replaced/);
    await f.update(undefined, "Renamed");
    assert.equal(f.state.row.imageVersion, "new");
    const remove = new FormData(); remove.set("removeImage", "true");
    await f.update(remove, "Renamed");
    assert.equal(f.state.row.imageData, null);
    assert.match(f.state.audits.at(-1)!, /image removed/);
    assert.ok(f.state.invalidated.includes("/"));
    assert.ok(f.state.scopes.every((scope) => !JSON.stringify(scope).includes('"club"')));
  });

  test(`${kind} refuses missing records and unauthorized uploads before decoding or writing`, async () => {
    const f = fixture(); f.state.allowed = false;
    await assert.rejects(f.update(new FormData()), /denied/);
    assert.equal(f.state.prepared, 0);
    f.state.allowed = true; f.state.missing = true;
    assert.equal((await f.update(new FormData())).ok, false);
    assert.equal(f.state.prepared, 0);
    assert.equal(f.state.writes, 0);
  });

  test(`${kind} rolls the image back if auditing fails`, async () => {
    const f = fixture(); f.state.auditFails = true;
    await assert.rejects(f.update(new FormData()), /audit failed/);
    assert.equal(f.state.row.imageVersion, "old");
    assert.deepEqual(f.state.row.imageData, new Uint8Array([1]));
  });
}
