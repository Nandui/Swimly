import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/staff/constants";

export const BCRYPT_ROUNDS = 12;

/** bcrypt keeps at most 72 UTF-8 bytes. Counting characters would silently
 *  truncate accented letters and emoji, allowing distinct passwords to match. */
export const passwordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= 72,
    "That password is too long. Use fewer characters; accented letters and symbols take more space.");
