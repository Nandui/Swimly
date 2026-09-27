import "server-only";
import type { Session } from "next-auth";
import { myProviders } from "@/modules/my/providers";
import type { MyItem, MyProvider } from "@/modules/my/types";

export type MySection = { id: string; moduleId: string; title: string; empty: string } & (
  | { ok: true; items: MyItem[] }
  | { ok: false }
);

const TIME_LIMIT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

/** Runs every provider that applies to this person, in parallel, each with a
 *  time limit. A provider that fails or is slow becomes a "couldn't load"
 *  section; it never takes the page down or delays the others. */
export async function loadMyHub(session: Session, providers: readonly MyProvider[] = myProviders()): Promise<MySection[]> {
  const ctx = { userId: session.user.id, orgId: session.user.orgId ?? null, session };
  const applicable = providers.filter((p) => !p.appliesTo || p.appliesTo(ctx));
  const results = await Promise.allSettled(applicable.map((p) => withTimeout(p.load(ctx), TIME_LIMIT_MS)));
  return applicable.map((p, i) => {
    const result = results[i];
    const base = { id: p.id, moduleId: p.moduleId, title: p.title, empty: p.empty };
    if (result.status === "fulfilled") return { ...base, ok: true as const, items: result.value };
    console.error(`[my] ${p.id} failed:`, result.reason instanceof Error ? result.reason.message : "unknown");
    return { ...base, ok: false as const };
  });
}
