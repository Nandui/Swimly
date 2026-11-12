import { revalidatePath } from "next/cache";

/** Training writes. The catalogue needs `training.manage`; assigning and
 *  cancelling need `training.assign` for that person; sign-off needs
 *  `training.signoff` for that person and is never your own. Completing your
 *  own training is not here: Work has no personal actions (see self.ts, used
 *  by the staff API for Turnfin Me). Every change is audited in the same
 *  transaction, and each status move only happens from the state it expects,
 *  so two people acting at once cannot both win. */

export const refresh = (...paths: string[]) => { for (const path of ["/training", ...paths]) revalidatePath(path); };
export const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
