/** Make or change a Turnfin Courses account from the command line.
 *
 *    npm run account -- --email sam@example.com --name "Sam Example" --grants desk,teach \
 *      [--sites <siteId,siteId>] [--person-email sam@example.com] [--org <orgId>] [--deactivate] [--confirm]
 *
 *  A dry run until `--confirm`: it says what it would do and writes nothing.
 *  The password is read from COURSES_ACCOUNT_PASSWORD, never from the command line (which
 *  shells keep in history). It is needed for a new account; on an existing one it is changed
 *  only when the setting is present. Every change is logged in `courses_log`.
 *
 *  `--person-email` links the account to the Turnfin person record with that email, which the
 *  existing course tables name as instructor or marker (docs/courses.md, Accounts). The
 *  organisation comes from that person unless `--org` is given. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { GRANTS, isGrant } from "@/access/grants";
import { cleanEmail } from "@/access/tokens";
import { db } from "@/data/db";
import { log } from "@/data/log";

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  return value && !value.startsWith("--") ? value : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);
const list = (value: string | undefined) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : undefined);

function stop(message: string): never {
  console.error(`[account] ${message}`);
  process.exit(1);
}

const email = cleanEmail(flag("email") ?? "");
if (!email.includes("@")) stop("Give --email.");
const grants = list(flag("grants"));
const unknown = (grants ?? []).filter((grant) => !isGrant(grant));
if (unknown.length) stop(`Unknown grants: ${unknown.join(", ")}. The grants are: ${Object.keys(GRANTS).join(", ")}.`);
const siteIds = list(flag("sites"));
const password = process.env.COURSES_ACCOUNT_PASSWORD;
if (password !== undefined && password.length < 12) stop("COURSES_ACCOUNT_PASSWORD must be at least 12 characters.");
const confirm = has("confirm");

const existing = await db.coursesAccount.findUnique({ where: { email } });

if (siteIds?.length) {
  const found = await db.club.findMany({ where: { id: { in: siteIds } }, select: { id: true } });
  const missing = siteIds.filter((id) => !found.some((site) => site.id === id));
  if (missing.length) stop(`No site with id: ${missing.join(", ")}.`);
}

const personEmail = flag("person-email");
const person = personEmail
  ? await db.user.findUnique({ where: { email: cleanEmail(personEmail) }, select: { id: true, name: true, orgId: true } })
  : null;
if (personEmail && !person) stop(`No Turnfin person record with the email ${personEmail}.`);

const orgId = flag("org") ?? existing?.orgId ?? person?.orgId;
if (!orgId) stop("Give --org, or --person-email for someone whose record names their organisation.");
const name = flag("name") ?? existing?.name ?? person?.name;
if (!name) stop("Give --name.");
if (!existing && !password) stop("A new account needs COURSES_ACCOUNT_PASSWORD.");

const next = {
  name,
  grants: grants ?? existing?.grants ?? [],
  siteIds: siteIds ?? existing?.siteIds ?? [],
  personId: person?.id ?? existing?.personId ?? null,
  isActive: has("deactivate") ? false : true,
};

console.log(`[account] ${existing ? "Change" : "Make"} ${email}`);
console.log(`  name:     ${next.name}`);
console.log(`  grants:   ${next.grants.join(", ") || "(none)"}`);
console.log(`  sites:    ${next.siteIds.join(", ") || "every site"}`);
console.log(`  person:   ${next.personId ? "linked to a Turnfin person record" : "not linked"}`);
console.log(`  active:   ${next.isActive ? "yes" : "no"}`);
console.log(`  password: ${password ? (existing ? "changed" : "set") : "unchanged"}`);

if (!confirm) {
  console.log("[account] Dry run: nothing was written. Add --confirm to do it.");
  process.exit(0);
}

const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
await db.$transaction(async (tx) => {
  const account = existing
    ? await tx.coursesAccount.update({
        where: { id: existing.id },
        // A new password or a deactivation also unlocks nothing by itself; a new password clears the count.
        data: { ...next, ...(passwordHash ? { passwordHash, failedSignIns: 0, lockedUntil: null } : {}) },
      })
    : await tx.coursesAccount.create({ data: { ...next, email, orgId, passwordHash: passwordHash! } });
  // A changed password or a deactivated account signs every browser out.
  if (existing && (passwordHash || !next.isActive)) await tx.coursesSession.deleteMany({ where: { accountId: account.id } });
  await log(tx, {
    orgId,
    account: null,
    actorName: "Script: account",
    action: existing ? "account.changed" : "account.created",
    record: "account",
    recordId: account.id,
    detail: { grants: next.grants, siteIds: next.siteIds, active: next.isActive, passwordChanged: Boolean(passwordHash), linked: Boolean(next.personId) },
  });
});
console.log(`[account] Done: ${existing ? "changed" : "made"} ${email}.`);
process.exit(0);
