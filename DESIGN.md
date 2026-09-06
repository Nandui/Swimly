# Swimly — the doctrine

Swimly's look is **Astryx**, Meta's open design system, in its **Neutral**
theme: quiet greys, a near-black accent, white cards on a pale ground, Figtree
throughout, and both colour modes drawn from one set of tokens through
`light-dark()`. The mode follows the device unless the person picks one.
Adopted on 5 Sep 2026 in place of the generated ui-ux-pro-max system, which
is superseded for everything visual; its UX patterns (searchable pickers,
collapse-not-scroll, one H1) still hold and are restated below.

Astryx is a component library, not a colour file. The app uses its
components — AppShell, SideNav, Button, TextInput, Selector, Typeahead,
Dialog, Banner, Badge, Toast, Text and Heading — and its tokens, through the
CSS it ships. Nothing here is styled by hand that Astryx already draws.

The authority on how a component behaves and what it takes is Astryx's own
documentation, read from the CLI so it matches the installed version:

```bash
npx astryx component <Name>        # props, examples, theming surface
npx astryx search "<thing>"        # find a component, hook or doc
npx astryx docs <topic>            # layout, tokens, color, typography, motion…
npx astryx template --list         # page and block recipes
```

This file records how Astryx was wired into a Next.js app that already had
eighty screens, the decisions taken where Astryx leaves room, and the
architectural decisions that hold regardless of how the app looks.

---

## The rules, non-negotiable

These are the ones that get broken first, and breaking any of them is what
makes Swimly stop looking like itself.

- **Astryx's component before a hand-drawn one.** A button is `Button`, a
  field is `TextInput`, a choice is `Selector`, a notice is `Banner`, a
  heading is `Heading`. Tailwind is for layout — flex, grid, gap, width —
  not for drawing controls.
- **Tokens, never colours.** Every colour comes from an Astryx token, either
  as a Tailwind utility the bridge provides (`bg-surface`, `text-primary`,
  `text-secondary`, `border-border`, `bg-muted`) or as `var(--color-*)`. No
  hex, no Tailwind palette class, in a component.
- **Status colour comes only from the tag token pairs**, always via a
  metadata map — never a colour chosen at a call site. The pairs are Astryx's
  hue tokens, so a `<Tag>` and a `<Badge>` of the same colour agree.
- **Both modes, always.** Every token is a `light-dark()` pair measured by the
  theme; anything added by hand is checked in both.
- **One H1 per page**, from `Heading level={1}` via `PageHeader`, with an
  optional secondary description line. Section headings are H2.
- **Collapse, don't scroll.** Secondary table columns re-home as a muted second
  line below `md`. Anything that grows without limit goes behind a searchable
  picker (`Selector hasSearch`, or `Typeahead` when the server must search).
- **Every mutation is audited**, scripts included, with a summary naming what
  changed and to what.
- **Ask for a permission, not a role.** `can(session, "students.manage")`,
  never a role's name. Roles are the club's to invent and rename, so nothing in
  the code may depend on one existing.

---

## Decisions taken for Swimly

### How Astryx is wired in

**CSS layers, declared up front.** Astryx ships its component styles as plain
CSS in cascade layers, no build plugin. `globals.css` declares every layer in
one line — `reset, theme, base, astryx-base, astryx-theme, components,
utilities` — then imports Tailwind's theme and preflight, Astryx's reset, core
and Neutral theme, the bridge, and Tailwind's utilities, in that order. That
is what lets a `className` on an Astryx component still win. Unlayered rules
at the bottom of the file beat everything and are kept few.

**The bridge, with the app's text sizes.** `@astryxdesign/core/tailwind-theme.css`
turns Astryx's tokens into Tailwind utilities, including the 4px spacing
scale and the radius scale (`rounded-md` is the 10px element radius,
`rounded-lg` the 12px container radius). It also maps `text-sm` to Astryx's
12px "sm", which would have shrunk every body line in the app. So the names
keep their pixel meaning: `text-xs` 12, `text-sm` 14 (Astryx's body size),
`text-base` 16, `text-lg` 17.

**No legacy names.** The move went in two passes: first a block of aliases
in `@theme inline` kept the old shadcn names (`text-foreground`,
`bg-muted`…) rendering while the shell and the controls were swapped, then
every page body was rewritten in Astryx's own components and the block was
deleted. Nothing in `src` names a colour, a size or a radius that is not
Astryx's, and `globals.css` is short enough to read in one go.

**Figtree through next/font.** Astryx never loads a font. The theme names
Figtree; the root layout self-hosts it with `next/font/google` and hands the
variable to the theme's font tokens on `[data-astryx-theme]`, which is where
the theme sets them.

**Tag pairs are Astryx hues.** `--tag-<colour>-bg/fg` are aliases of
`--color-background-<hue>` and `--color-text-<hue>`. Astryx has no brown;
teal stands in and reads as its own hue.

**Phone sizes, once.** Astryx sizes controls for a pointer: 28, 32, 36px. A
thumb on a wet phone needs 44. One unlayered media rule gives every button,
field, menu row, nav item and tab a 44px minimum below `md`.

**Nothing is drawn by hand.** Every heading is `Heading`, every run of words
is `Text`, every list of records is `Table` (children mode, which is
server-safe) or `List` with `Item`, every region is a stack or a `Section`,
a discrete thing is a `Card`, a fold is a `Collapsible`, a notice is a
`Banner`, a count that needs noticing is a `Badge`, a mark is a
`ToggleButtonGroup` with a `StatusDot` beside the name. Tailwind classes
appear only for layout Astryx's props cannot express — a responsive column
that hides below `md`, a centred page column — never for a colour, a
size or a radius. The one CSS rule the app adds to Astryx's controls is the
44px phone minimum.

### Two modes, the device decides

The mode is a cookie, `swimly.theme`, read by the root layout on the server.
It stamps `data-theme` on `<html>` (which reset.css turns into
`color-scheme`) and seeds Astryx's `<Theme mode>`, so the first paint is
right and hydration has nothing to disagree about. No cookie means "follow
the device". The one-tap flip sits in the side nav's footer and the phone
bar; the three-way control on the Account page is where "system" is
restored. `next-themes` is gone.

### The shell

Astryx's `AppShell` in `height="auto"` (the page scrolls, the nav sticks) and
`variant="section"` (a divider between nav and content, no raised surface).
The `SideNav` holds the product name, the club switcher above the nav, the
screens the role may open, and in the footer the account row and the mode
flip; it collapses to an icon rail. Below `md` the AppShell folds the nav
into a drawer and shows the `TopNav` as a bar — product name, club, flip,
toggle — which is hidden from 769px up, since there is no top bar on
desktop in this design. AppShell owns the skip link and the `<main>`
landmark; pages start at their H1. The dev build's "view as" bar is a
`Banner status="warning" container="section"` in the shell's banner slot.

### Fields that post: Astryx's inputs inside plain forms

Every form in the app is a plain `<form>` read with `FormData` by a server
action, and Astryx's inputs are controlled. `src/components/ui/{input,
textarea,switch,select}.tsx` are the join: each holds the value in state,
renders Astryx's `TextInput`, `TextArea`, `Switch` or `Selector` with
`htmlName`, and the form posts as before. `Field` in `form-dialog.tsx` hands
its label and hint to one of those, and wraps anything else in Astryx's
`Field`. A date, time or number keeps the native control — the browser's
picker is the right one on a phone — inside that same `Field`. A set of
ticks (`CheckboxList`, `RadioList`) posts through one hidden input per
tick. Buttons need no join: every call site is Astryx's `Button` or
`IconButton` with its own `label`.

### Toasts through one bridge

Astryx hands out toasts through a hook, which is useless at the tail of a
transition that has just awaited a server action. `src/lib/toast.tsx` keeps
the imperative `toast.success` / `toast.error` every call site uses and one
mounted `<ToastBridge>` carries each call to Astryx's `useToast`. Errors stay
until dismissed, which is Astryx's default and the right one on a deck.

### Dialogs keep a rich description

Astryx's `AlertDialog` takes a plain-string description. A consequence here
often carries a name in bold, so `ConfirmAction` and the take-over question
are `Dialog purpose="form"` with a `DialogHeader`, a `Text` body and an
`HStack` of buttons at the end. `FormDialog` is the same shape around a form.

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

### Cover is self-declared, and recorded

The register was scoped to the instructor on the course, and cover needed an
admin to reassign it. That held until the first evening a class went
unmarked because the one person who could reassign had gone home. Now the
person standing at the pool says so: opening a class that is not theirs
asks whether they are taking it, and confirming writes a `ClassCover` row
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

- It is built from Astryx components; anything drawn by hand has a reason
  written beside it. `npx astryx component <Name>` was read for each one used.
- One H1, from `PageHeader`.
- Every status is a `<Tag>` or `<Badge>` fed by a metadata map, and it reads
  in both modes.
- No colour outside the tokens: no hex, no Tailwind palette class, no name
  from the legacy alias block in new code.
- Every text pair 4.5:1 and every control edge 3:1, checked in light and dark
  for anything not drawn by the theme.
- Keyboard: Astryx's focus outline on everything focusable, the skip link
  first, `prefers-reduced-motion` honoured.
- 375px checked: 44px targets, nothing scrolling sideways, the phone bar's
  toggle on screen.
- Row actions carry `aria-label`s naming the verb and the row, and stay
  reachable on touch.
- Secondary columns collapse rather than scroll below `md`.
- Every mutating action authorizes first, guards before writing, audits after,
  and returns `{ ok: false, error }` for anything a person can fix.
