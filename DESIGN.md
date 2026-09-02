# Swimly — the doctrine

Swimly's visual system is **generated, not hand-picked**. The ui-ux-pro-max
skill's design-system engine produced it for this product on 1 Sep 2026 and it
is persisted at [`design-system/swimly/MASTER.md`](design-system/swimly/MASTER.md):
**Minimalism**, built on the engine's logic for a **booking and appointment
tool** — trust blue for everything interactive, green for "a place is
available", grey for "booked", a light ground with a faint blue cast, Outfit
for headings and Work Sans to read, subtle 200ms motion. That file is the
authority on how things look; page-level exceptions go in
`design-system/swimly/pages/`, and a question it does not answer is put to the
skill, one intent per query.

**Describe the product, not the user, when asking the engine.** The first run
called Swimly a "staff admin dashboard internal tool" and got back a dark tech
palette with code fonts, filed under IoT dashboards. Swimly is a leisure
centre's tool for swim lessons and other bookings; asked that, the engine
answered as above. The query is recorded at the top of MASTER.md.

The previous doctrine — "the well-kept page", a warm-grey document style with
one blue — is superseded by decision on that date. Its components are still
vendored at `src/components/ui-kit/` and still used; its visual rules are not.
The kit remains a submodule at `.claude/skills/design-kit` for its component
recipes only.

This file records what MASTER.md cannot: how the generated system was mapped
onto shadcn's tokens, where it had to be corrected, and the architectural
decisions that hold regardless of how the app looks.

---

## The rules, non-negotiable

These are the ones that get broken first, and breaking any of them is what
makes Swimly stop looking like itself.

- **Tokens, never colours.** Every colour a component shows comes from a
  variable in `globals.css`, which follows MASTER.md. No hex, no Tailwind
  palette class, in a component.
- **One blue, for interaction.** `--primary` is the engine's trust blue:
  buttons, links, focus, caret, selection. Green means *available* and lives in
  the tag pairs and `--success`; it is never a button.
- **Status colour comes only from the tag token pairs**, always as the pair
  (field + same-hue ink, one set per mode), always via a metadata map — never
  a colour chosen at a call site.
- **Both modes, always.** Every pair is measured in light and in dark before
  it ships: text 4.5:1, control edges 3:1. The engine's own checklist.
- **One H1 per page**, in the heading face, with an optional muted description
  line. Section headings are H2.
- **Collapse, don't scroll.** Secondary table columns re-home as a muted second
  line below `md`. Anything that grows without limit goes behind a searchable
  picker.
- **Every mutation is audited**, scripts included, with a summary naming what
  changed and to what.
- **Ask for a permission, not a role.** `can(session, "students.manage")`,
  never a role's name. Roles are the club's to invent and rename, so nothing in
  the code may depend on one existing.

---

## Decisions taken for Swimly

### Two modes, the system decides

The engine emitted a light palette and marked the style "mode: auto", so Swimly
ships both. `next-themes` sets `class="dark"` on `<html>` and defaults to the
operating system. A one-click sun/moon flip sits above the account menu in the
sidebar and at the right end of the mobile bar — the deck is bright at noon and
dim at seven, so the switch is never more than one tap away. The three-way
control on the Account page is where "follow the system" is restored. The dark
palette is the same blue/slate scale read from the other end.

### How MASTER.md maps onto shadcn, and where it was corrected

The engine speaks in roles (Primary, Accent/CTA, Card…); shadcn speaks in
tokens. The mapping, and the two places the generated values failed the
engine's own pre-delivery bar and were corrected rather than shipped:

| MASTER.md role | Token | Note |
|---|---|---|
| Primary `#2563EB` | `--primary`, `--ring` | Blue-600: white text at 5.2:1, link text at 4.9:1. In dark it becomes blue-400 with slate ink (7.0:1) — lighter tonal variant, not an inversion, and the only blue that reads as a link on slate-900. |
| Accent/CTA `#059669` | `--success` (and the green tag pair) | White on emerald-600 is **3.77:1** and fails, so the pair is emerald-700 (5.5:1). It marks "available" and "confirmed", never the primary button — a booking tool has one interactive colour. |
| Secondary `#3B82F6` | `--secondary` = `--accent` = `#E4ECFC` | Blue-500 as a second interactive blue would compete with the first; the blue-cast hairline tint is the hover surface instead. |
| Border `#E4ECFC` | `--border` | 1.1:1 — a hairline between rows, which is all it is for. Inputs use `--input` at slate-500: 4.6:1 light, 3.75:1 dark. |
| Muted `#F1F5FD` | `--muted`, `--sidebar` | The faint blue cast that keeps the ground from reading as plain grey. |
| Destructive `#DC2626` | `--destructive` | Passes as emitted: white at 4.8:1. |

Radius stays `0.375rem` — the engine names none, and a family leisure centre is
not a place for hard corners. Transitions default to 200ms, per "Key Effects".
The MASTER shadow scale is exposed as tokens and applied to nothing at rest.

The former warm-grey neutrals (hue 95–106) are gone with the doctrine that
needed them; the slate here leans blue, faintly, on purpose.

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
`src/lib/enrolment/actions/enrolment.ts` takes `SELECT … FOR UPDATE` on the
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

### Batched writes, on purpose

The register and the assessment checklist each save as **one action carrying
the whole class**. Next dispatches Server Actions one at a time per client, so
a save per tap would queue on poolside wifi. Batching also means a dropped
connection leaves the marks in the tab and retryable, and the register mirrors
itself into `localStorage` so they survive a closed tab. Neither writes an
audit row when nothing changed — the existing rows have to be read to build the
diff anyway, so a "did that save?" re-submit costs nothing.

---

## Placeholders to replace

- **The metadata description** in `src/app/layout.tsx` is a placeholder
  sentence. Replace it when the product has its own.
- **`SCHOOL_TIMEZONE`** in `src/lib/format.ts` is `Europe/Dublin`. Everything
  that asks "what day is it?" asks it there, not the server.
- **The seeded curriculum** in `scripts/seed-curriculum.ts` is a plausible
  starting point, not a recommendation. Rename it to what the club teaches.

---

## Where things live

```
src/app/(app)/                 the signed-in shell and its pages
src/app/sign-in/               the front door, outside the shell
src/components/ui-kit/         the kit's own components — tag, page-header,
                               empty-state, app-shell. Treat as vendored.
src/components/ui/             shadcn primitives. They pick up the tokens.
src/components/                app components composed from both
src/lib/<domain>/data/         reads  — plain async functions, no "use server"
src/lib/<domain>/actions/      writes — "use server", one exported action per verb
src/lib/<domain>/constants.ts  one metadata map per enum, plus domain vocabulary
src/lib/authz.ts               can(), and the require* guards
src/lib/staff/permissions.ts   the permission catalogue, and what each means
src/lib/staff/keyholders.ts    the guard that keeps somebody able to get in
src/lib/page-guards.ts         the page-level versions, which 404 rather than throw
src/lib/audit.ts               logAudit — pass the tx client when it must be atomic
src/lib/action-result.ts       the result type and the six-step action shape
src/lib/format.ts              the pinned formatters; the only place a date is built
scripts/                       one-off work, run with tsx, held to the app's rules
```

The domains, and who may write to each:

```
curriculum/    Programme, Level, Competency          curriculum.manage
courses/       Course                                courses.manage
students/      Student                               students.manage
enrolment/     Enrolment, waitlist, the seat lock    enrolment.manage
attendance/    AttendanceRecord, ClassNote           attendance.mark / .markAny
progression/   CompetencyResult, LevelCompletion     progression.assess / .override
               rules.ts — pure, neither read nor write
activity/      the audit log                         activity.view
staff/         User, StaffRole                        staff.manage, roles.manage
```

Reads and writes stay in separate files so a read cannot quietly grow a write.
`rules.ts` is neither: every screen that asks "can she move up?" asks it there,
so the app has one answer rather than one per page.

### The shape of a mutating action

Authorize, validate, guard, write, audit, revalidate — in that order. A guard
that runs after the write has already lost, and an audit entry written before
the write can describe something that never happened. The full worked shape is
in the comment at the top of `src/lib/action-result.ts`.

Errors a person can fix are return values (`{ ok: false, error }`), rendered
next to the field. Throwing is for "this should not have been possible".

### Scripts are part of the product

Idempotent, self-disabling, audited, and deliberate when destructive.
`prisma/seed.ts` is the reference implementation: it declines once an admin
exists, matches on the email so a second run updates rather than duplicates,
and writes an audit row for the account it creates.

---

## Checking your work

Before calling a screen done:

- One H1, in the heading face.
- Every status is a `<Tag>` fed by a metadata map, and it reads in both modes.
- Blue appears only where something is interactive; green only where a place
  is available or a thing is confirmed.
- Every text pair 4.5:1 and every control edge 3:1, checked in light and dark.
- Keyboard: a visible ring on everything focusable, the skip link first,
  `prefers-reduced-motion` honoured.
- Row actions carry `aria-label`s naming the verb and the row, and stay
  reachable on touch (`max-md:opacity-100`).
- Secondary columns collapse rather than scroll below `md`.
- Every mutating action authorizes first, guards before writing, audits after,
  and returns `{ ok: false, error }` for anything a person can fix.
