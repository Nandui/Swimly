"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD_LENGTH } from "@/lib/staff/constants";

/** Changing your own password is the one write in the app that is not tiered.
 *  A viewer may do it, and an admin may not do it *for* someone without it
 *  showing up as a reset in the log — which is the difference that makes an
 *  admin-set password temporary rather than permanent.
 *
 *  The current password is required even though the session already proves who
 *  is asking. A session is a cookie on a machine that may be shared, unlocked
 *  or borrowed; the current password is the thing only the person knows. */

const BCRYPT_ROUNDS = 12;

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      .max(72, "Keep the password to 72 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "The two new passwords do not match.",
    path: ["confirm"],
  });

export async function changeOwnPassword(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { current, next } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!user) return fail("That account no longer exists.");

  // No hash means the account was never given a password to begin with — an
  // admin has to set the first one, because there is nothing here to prove
  // against.
  if (!user.passwordHash) {
    return fail("This account has no password yet. Ask an admin to set one for you.");
  }
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return fail("That is not your current password.");
  }
  if (await bcrypt.compare(next, user.passwordHash)) {
    return fail("That is the password you already have. Choose a different one.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, BCRYPT_ROUNDS) },
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "update",
    entity: "User",
    entityId: user.id,
    summary: `${user.name} changed their own password`,
  });

  return ok();
}
