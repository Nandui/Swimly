import { createHash, randomBytes } from "node:crypto";

/** Makes a key for one outside app to use the classes API (/api/classes/v1; docs/operations.md).
 *  It writes nothing and contacts nothing: it prints the key once, for that app's own settings,
 *  and the entry to add to Turnfin's CLASSES_API_KEYS. Turnfin keeps only the key's SHA-256, so
 *  a lost key cannot be read back: make a new one and replace the entry.
 *
 *  npx tsx scripts/classes-api-key.ts "Staff scheduler" */
const name = (process.argv[2] ?? "").trim();
if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(name)) {
  console.error('Name the app, in letters, numbers, spaces, - or _ (up to 40): npx tsx scripts/classes-api-key.ts "Staff scheduler"');
  process.exit(1);
}
const key = `tfc_${randomBytes(32).toString("base64url")}`;
console.log(`Key for ${name} (give it to that app only; it is not shown again):\n  ${key}\n`);
console.log(`Add this entry to CLASSES_API_KEYS in Turnfin's settings (entries are separated by commas):\n  ${name}:${createHash("sha256").update(key).digest("hex")}`);
