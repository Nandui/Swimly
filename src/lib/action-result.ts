/** What a server action returns.
 *
 *  Actions do not throw at the caller for anything a person can fix. A taken
 *  email, a name that is too long, an edit to something already deleted — each
 *  comes back as `{ ok: false, error }` carrying one sentence written for the
 *  person who typed it, and the form renders it next to the field. Throwing is
 *  reserved for the cases where the answer really is "this should not have
 *  been possible": a failed authorization check, a lost database.
 *
 *  The result is a discriminated union so TypeScript forces the caller to look
 *  at `ok` before reaching for anything else.
 *
 *  The shape of every mutating action, in order:
 *
 *    "use server";
 *    export async function updateThing(id, input): Promise<ActionResult> {
 *      const session = await requirePermission("thing.manage"); // 1. authorize first
 *      const parsed = thingSchema.safeParse(input);    // 2. validate
 *      if (!parsed.success) return fail(parsed.error.issues[0].message);
 *      const existing = await prisma.thing.findUnique({ where: { id } });
 *      if (!existing) return fail("That no longer exists.");
 *                                                      // 3. business guards
 *      const thing = await prisma.thing.update(...);   // 4. write
 *      await logAudit({ ... });                        // 5. audit the change
 *      revalidatePath("/things");                      // 6. refresh
 *      return ok();
 *    }
 *
 *  Guards before writes, audit after. A check that runs after the write has
 *  already lost, and an audit entry written before it can describe a change
 *  that never happened. */

export type ActionResult = { ok: true } | { ok: false; error: string };

export function ok(): ActionResult {
  return { ok: true };
}

/** @param error One sentence, addressed to the person, ending in a full stop. */
export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Uniqueness checked in application code can always lose to a concurrent
 *  write; the database index is the real arbiter. Wrap the write and turn its
 *  P2002 into the same sentence your pre-check would have returned, so a race
 *  reads as a normal validation failure instead of a crash.
 *
 *    const thing = await onUniqueViolation(
 *      () => prisma.thing.update({ where: { id }, data }),
 *      `${data.email} already has an account.`
 *    );
 *    if ("error" in thing) return thing;
 */
export async function onUniqueViolation<T>(
  write: () => Promise<T>,
  error: string
): Promise<T | { ok: false; error: string }> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error };
    throw err;
  }
}

/** The predicate on its own, for writes that cannot use the wrapper.
 *
 *  Inside a transaction a failed statement aborts the whole thing, so a P2002
 *  caught and turned into a return value would leave the surrounding
 *  `$transaction` trying to commit something Postgres has already given up on.
 *  Let it throw out of the transaction, and catch it here. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
