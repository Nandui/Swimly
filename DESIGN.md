# Swimly design and engineering

The main app adopts the reviewed redesign on the staging branch: warm neutral
surfaces, blue primary actions, amber highlights, Figtree, and restrained motion.
The earlier visual system and generated design-system guidance are superseded.

## Components and tokens

Owned shadcn source lives in `src/components/primitives`, using Base UI for
accessible behaviour. `components.json` records its base-vega configuration.
`src/components/workspace` contains reusable layout, fields, choices, overlays,
feedback and typography. `src/components/ui` provides form-friendly controls;
`src/components/ui-kit` contains app-specific compositions. Feature components
compose these with semantic HTML. There is no production dependency on the
fictional prototype.

Colour and shape are semantic CSS tokens in `src/app/globals.css`. Both light
and dark use the same token names through light-dark(). Primary actions use
blue with an explicit contrast-safe hover token. Warnings, errors and success
have separate foreground/background pairs. Status meanings come from domain
metadata maps. Figtree is self-hosted in four weights. Body text is 14px; touch
inputs and poolside marks remain readable, and targets are at least 44px.

Spacing follows a four-point scale. Desktop pages use 32px insets, tablets 24px,
phones 16px; panels use 24px/20px/16px as appropriate. Data is shown in readable
rows, with secondary metadata below names. The app shell owns the main landmark,
page width and skip link. Desktop navigation has Workspace and Manage groups;
mobile has reachable primary destinations and a More dialog. The club stays
visible. Account owns personal preferences and sign-out.

The theme preference is stored in the existing cookie and stamped by the server
before first paint. Device mode is CSS-first, then synchronised by the provider.
Base UI manages dialog, menu, combobox and tab keyboard interaction. Dialogs
retain field values and context on failure, restore trigger focus after closing,
and keep errors beside the fields. Native form values still post through FormData.

## Reception and poolside

Reception puts swimmer lookup above the connected swimmer/timetable workspace.
Places, contact, notes and progress retain selection. Enrolment, transfer and
assessment booking use the existing audited, permission-checked actions. Phone
Swimmer and Today views retain their filters and selection when switching.

Today foregrounds the current/next class and keeps unfinished attendance visible.
Opening a class exposes Attendance and Competencies freely. Across-class and
single-swimmer views edit one LessonDraft. Opening a class never writes defaults.
Marks start unmarked; selecting Mark remaining present is an explicit bulk edit.

LessonDraft stores only identifiers, edited marks and notes on this device under
a user/club/class/date key. It batches after a pause, permits one in-flight save,
and acknowledges immutable edit generations. Network failures retry with backoff;
validation/permission failures pause. Version conflicts retain the draft and
require review. Keeping local changes rebases only edited fields over the saved
record, preserving unrelated changes and added roster entries.

`saveLesson` validates versions and permissions, locks the course and existing
competency results, writes changes and audit records in one transaction, and
retains the seat lock. Confirming attendance is a separate explicit request after
all saves succeed. `AttendanceCompletion` stores a dated roster fingerprint;
roster, mark timestamp or note changes invalidate it, including edits from the
older live app. Level completion, cover and enrolment remain explicit actions.

## Deployment

`codex/staging-redesign` is the staging branch. Its permanent hostname is
`swimly-staging.vercel.app`. It uses the existing database at the user's request.
Hosted staging requires credentials, has a separate session cookie, and labels
that changes affect live records. Main's production deployment is unchanged.
Schema changes must be additive. Verify builds with `npx next build`; the
repository production build command also runs migrations. Never seed live data
or create test records merely to verify the interface.

## Operational architecture retained

### Roles are data, permissions are code

This started as three fixed tiers — admin, manage, view — mapped from a `Role`
enum, and that held for exactly as long as the club had three kinds of person.
It stopped holding when a role was wanted that could edit the timetable but not
accounts, which is neither "changes the rules" nor "changes the data". The
honest options were a fourth tier and then a fifth, or roles as data. Roles won.

**The catalogue is code.** `src/lib/staff/permissions.ts` lists every
permission the app has to give, because a permission exists only when a screen
or an action asks for one. There is no Permission table: it would be a second
copy of that list, kept in step by hand, with nothing to catch it drifting.
`StaffRole.permissions` is a plain string array of keys from it, and a key that
is no longer in the catalogue is ignored rather than fatal — which is what
makes deleting a permission a safe edit.

**Reads are not permissioned.** Anyone signed in can look at swimmers, classes,
the curriculum and the registers, exactly as before. Every permission is the
power to *change* something, or to read the audit log — the one read that names
what everyone else did. Making reads grantable is a different and larger
decision: every data function would take a permission and every page would need
an empty state for "you may not see this".

**Nothing may leave the app without a keyholder.** `staff.manage` and
`roles.manage` are load-bearing — lose either across every active account and
the way back in is a database console, because `prisma/seed.ts` declines once
an admin exists. `src/lib/staff/keyholders.ts` refuses any edit that would do
it, by computing what the world would look like afterwards rather than by
counting admins: with arbitrary roles there is no such thing as "an admin".
It deliberately sits outside a `"use server"` file, because every export from
one of those is an endpoint the browser can call.

**Nothing refers to a role by name.** Not the code, not the nav, not the seed.
That is what lets a club rename or delete every role the app shipped with.

**A role also says which screens exist.** `StaffRole.screens` holds keys
from the catalogue in `src/lib/staff/screens.ts`, one per top-level page.
The nav shows only those; every page under the shell opens with
`screenPage(screen, permission?)` and 404s for anyone whose role does not
name it; a link that crosses into another screen asks `canSee` before it
renders. Permissions are still the power to change something — screens are
what is on the menu at all. That is how an instructor role is given Today
and nothing else: the deck becomes their whole app. Account is never on the
list because it is always there. The keyholder guard checks screens too:
nobody may untick Roles or Staff from the last role that can reach them.

**A role also says where its day starts.** `StaffRole.home` is a key from the
`ROLE_HOMES` map in the catalogue file — the overview for the desk, Today for
an instructor. The sign-in form pushes to `/start`, which reads the role and
redirects; the wordmark goes to the same place. A role set to start on Today
without the permission that opens it lands on the overview instead.

**The deck's permissions are cut fine on purpose** — taking your own
attendance, taking over a colleague's class, marking competencies, completing
a level, running an assessment session — because the club wanted to build an
instructor role that does exactly some of those and not the rest. Each is a
different act with a different record, so each is its own key, and the
implication map keeps the broader ones (`attendance.markAny`,
`progression.override`) granting the narrower.

Two things stay **scoping rules inside actions** rather than permissions:

- **Whose register.** `attendance.mark` marks the classes you teach;
  `attendance.markAny` marks anybody's. Which classes are *yours* is a fact
  about the row, not about you, so it lives in `canMarkRegister` in
  `src/lib/attendance/access.ts`.
- **Completing a level with gaps** is `progression.override`, and needs a
  reason. Placing a swimmer at a level they have not earned is *not* — see
  below.

Some permissions contain smaller ones (`attendance.markAny` grants
`attendance.mark`). That closure lives in one map in the catalogue, not at each
call site, because the call site that forgets is the one that quietly locks
somebody out.

Guard the same rule in three places, because they answer different questions:
the **nav** hides what you can't reach (`visibleNavItems`), the **page** hides
the button (`src/lib/page-guards.ts`, which 404s rather than erroring), and the
**action** refuses the call. Only the last one is security.

The session is re-read from the database on every `auth()` rather than trusted
from the token, so deactivating an account, moving somebody to another role, or
un-ticking a permission on a role twelve people share all take effect
immediately instead of at token expiry. It costs one indexed query. Nothing but
the subject is minted into the JWT, for the same reason.

### Anything the size of the club is searched, not sent

The swimmer picker asks the server for the twenty that match what has been
typed (`src/lib/students/actions/search.ts`), debounced, and never receives the
roll. Two pages once shipped all 1,156 swimmers so that one could be chosen;
`/students` once shipped 500 so that they could be scrolled. The rule that
falls out: **a list that grows with the club goes behind a server search or a
page, never into props.** Classes are 134 and grow by a handful a term, so they
still travel as options — the moment that stops being true, they get the same
treatment.

A read that a client component calls lives in `actions/` with `"use server"`,
because that is the only door a client component has to the database. It still
authorizes, and its comment says why it is where it is.

### The timetable opens on today

`/courses` with no `day` in the URL shows today's classes. The whole week is
`day=any`, and the filter bar writes that value rather than deleting the key
when the chip is cleared — an absent key means today, so deleting it would snap
back. Every page has a `loading.tsx` above it (one file, at the `(app)`
segment) so the shell paints before the data does.

### The nav holds only pages that exist

A sidebar advertising routes nobody has built reads as a broken app, so add the
item in `src/lib/nav.ts` in the same change as the page.

### Auth is credentials-first, and swappable

Sign-in verifies an email and a bcrypt hash against the `User` table. Nothing
downstream knows that: every screen and action asks for a permission, so
moving to an email link or SSO is an edit to the `providers` array in
`src/auth.ts` and nothing else.

Failure is one sentence for every reason — wrong password, unknown address,
deactivated account. Saying which half was wrong turns the form into a way of
discovering who has an account.

`DEV_AUTH_BYPASS=1` signs you in as the first active admin **in the database**,
and is gated on `NODE_ENV !== "production"` as well as on the flag. It hands
out a real account rather than a fabricated one, so audit rows point at someone
who exists and permission checks behave exactly as they will in production.

### Deactivate, don't delete

`User.isActive` is the off switch. It is reversible, it keeps the audit trail
readable, and a deactivated account cannot sign in. Deleting a person is a
different and rarer decision; `AuditLog.actorId` is nullable and `actorName` is
denormalised so the log survives it either way.

---

### One app, several clubs

LeisureWorld runs more than one pool, and the second site wanted the same
tool without seeing the first site's swimmers. So a `Club` sits above
everything that is a site's own — programmes, and through them levels,
competencies and kinds of assessment; classes; swimmers; assessment
sessions — and every list the app shows is one club's. Staff accounts and
roles are shared: the same people cover both sites, and "may take a
register" means the same thing at either.

The club somebody is working in is a cookie, read once per request by
`getCurrentClub()` and memoised. The data modules scope themselves by it, so
a page cannot forget to; the actions that make a new programme, swimmer,
class or session stamp it on the row; and `logAudit` records it without
being told. The switcher sits above the nav on every screen, and in the bar
on a phone, because the mistake this guards against is enrolling a
Churchfield child into a Bishopstown class without noticing. A detail page
reached by link for something in another club says whose it is and offers
the switch, rather than quietly showing it surrounded by the wrong club's
pickers.

Two things are deliberately not built. Swimmers are never moved between
clubs — the other site enrols its own, with its own member numbers. And
copying a programme copies the curriculum only: levels, competencies, kinds
of assessment. Results and completions belong to the swimmer and to the club
they were earned in.

## The domain, and the four decisions holding it up

Programmes hold ordered levels; a level is defined by the competencies a
swimmer has to pass; a course teaches one level at a fixed weekly slot; a
student is enrolled into a course; a register is taken on the pool deck; and a
level is completed when everything is signed off and somebody confirms it.

**1. "Current level" belongs to a (student, programme) pair, never to a
student.** A swimmer can be in Learn to Swim and in Squad at once, so a screen
saying "Ava — Level 4" without saying which ladder is guessing. `Enrolment`
therefore **pins** `levelId` and `programmeId` at enrolment time. They are not a
cache of the course's level: they are the level the swimmer was *placed* at,
which must not move when a course is re-badged. Everything else — eligibility,
graduation, the current rung — is derived in `src/lib/progression/rules.ts` and
stored nowhere.

**2. Curriculum rows are archived, never deleted** (`archivedAt`, deliberately
diverging from `User.isActive`). For a competency, *when* it was retired
answers "was this required when Ava was assessed?". And one rule keeps a
curriculum edit from rewriting the past: **`LevelCompletion` is the truth for
"done"**, so eligibility is only ever computed for swimmers who have not
completed. Otherwise adding a competency would retroactively un-complete a
whole cohort. Each completion also freezes `competenciesAchieved` /
`competencyCount`, so months later you can still tell whether it was earned.

**3. Capacity is held by a row lock, not a re-count.** An interactive
transaction that merely counts again does not fix the race — at READ COMMITTED
two transactions both read 11 and both insert. `withCourseSeat` in
`src/lib/enrolment/seat.ts` takes `SELECT … FOR UPDATE` on the
course row first, which also makes the "already enrolled here?" check
race-free. That is why there is no unique constraint on
`(studentId, courseId)` — and why repeating a level, the most ordinary thing a
swim school does, is possible at all. **Nothing else may create an ACTIVE
enrolment.** A second write path that forgets the lock silently restores the
race.

**4. Classes are rolling and weekly — there are no term or session rows.** The
register is keyed on `(course, date, student)`, which means the *only* thing
between the table and attendance on days the class never ran is the guard in
`markRegister`: the weekday must match the course, the date must not be in the
future, and every swimmer must have been enrolled on it. That guard is
infrastructure, not a nicety. `ClassNote` is the cheap answer to "pool closed
this week", and it is also the seam: the moment it grows a `cancelled` boolean
or an instructor override, sessions have been rebuilt by accident and should be
built deliberately instead.

### Placement needs `enrolment.manage`, with a reason on the row

Placing a transfer-in or an adult beginner out of sequence is routine and
weekly. Putting it behind a rarer permission would produce one of two things —
the front desk gets given that permission and it stops meaning anything, or
somebody fakes a completion to get past the guard and the progression data
starts lying. So `enrolStudent` takes a `placementReason` and stores it **on
the enrolment**, not only in the audit log, because reading the log needs
`activity.view` and the instructor on the deck is exactly who needs to know why
this child is in Level 5.

### Moving up is gated on the completion, not on the last tick

All competencies passed makes a swimmer **eligible**; a person still confirms
they are done. "Move up to <next level>" only appears once that confirmation
exists, and it appears in both places completion happens — the student profile
and the class assessment screen.

Offering it a step earlier would walk straight into the placement guard and
demand a reason for something the swimmer had in fact earned. The move itself
reuses `transferEnrolment`, so the old place closes and a new one opens rather
than the enrolment being re-pointed: attendance hangs off
`(course, student, date)`, and rewriting the enrolment would orphan every
register they were already on.

### Cover is self-declared, and recorded

The register was scoped to the instructor on the course, and cover needed an
admin to reassign it. That held until the first evening a class went
unmarked because the one person who could reassign had gone home. Now the
person standing at the pool says so: a class that is not theirs offers an
explicit Take over action, and confirming writes a `ClassCover` row
for that class and date — who conducted it, and whose it was — which makes
the register and the checklist theirs to mark for the day. The register's
audit line names the cover and the instructor covered for; every competency
saved carries the name of whoever saved it, cover or not.

Self-declared is not the same as unaudited. Nothing about who taught a
class is inferred; it is stated once, kept on the row, and readable on the
register, the deck screen and the activity trail. Somebody holding
`attendance.markAny` is asked the same question, with a third answer for the
desk copying in a paper sheet: recording it for the instructor, not taking
it over.


## Verification checklist

- One H1, clear section headings, actionable empty and failure states.
- Shared controls, semantic tokens and consistent spacing; no library overrides.
- Both themes at 375, 768, 1024 and 1280px; no page overflow or clipped actions.
- Keyboard, visible focus, dialog focus restoration, 44px touch targets, reduced motion.
- Text contrast 4.5:1 and meaningful control edges 3:1.
- Named permissions, club scoping, atomic audit records and capacity locks retained.
- Test rapid edits, retries, reload recovery, conflict review and explicit completion.
- Run `npm run typecheck`, `npm run lint`, focused tests and an isolated Next build.
- Use fictional records for screenshots. Keep real personal/medical data out of artifacts.
