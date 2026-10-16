import { randomInt } from "node:crypto";

/** Certificate codes (docs/training.md, e-learning phase 4): 12 letters and
 *  digits in three groups, without ones that are easy to misread (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newCertificateCode = () => Array.from({ length: 12 }, (_, i) => (i && i % 4 === 0 ? "-" : "") + ALPHABET[randomInt(ALPHABET.length)]).join("");
/** A typed code as stored: capitals in groups of four, spaces and dashes ignored. Null when it can't be one. */
export function readCertificateCode(raw: string) {
  const plain = raw.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{12}$/.test(plain) ? plain.match(/.{4}/g)!.join("-") : null;
}
