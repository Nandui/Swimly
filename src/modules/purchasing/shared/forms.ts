import { revalidatePath } from "next/cache";
import { z } from "zod";

/** What Purchasing's orders and suppliers both write with. */

export function revalidatePurchasing(id?: string) {
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/suppliers");
  if (id) revalidatePath(`/purchasing/${id}`);
}
export const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).default("");

