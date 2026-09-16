# Swimly — design and implementation

The whole app uses **shadcn/ui**, Neutral surfaces with a logo-blue accent,
Figtree, and a cookie-backed
light/dark/system appearance preference. Components live in
`src/components/shadcn`. The owner approved the full conversion on 13 September
2026; no screen, form adapter or shared provider depends on another UI system.

## Design rules

- Compose actual shadcn controls; inspect their installed source before use.
  Buttons, dialogs, alerts, tables, items, inputs, selects, checkboxes, switches,
  radio groups, popovers and command lists already have accessible primitives.
- Use semantic HTML and Tailwind for structure and typography. Dense records
  are Item rows or Tables; Card is for a distinct panel, such as sign-in.
- Colours and radii use `ui-` utilities backed by `src/app/shadcn.css`. New
  components from the CLI must use this namespace and `@/lib/utils` for `cn`.
- Status labels use Badge or the shared Tag composition, with `data-tone`
  selected by a domain metadata map. Do not choose status colours at a call site.
- One H1 per page, 24px and semibold. Body text is 14px, supporting metadata
  12px, and section headings 20px. Preserve the existing Figtree weights.
- Default gaps are 16px within groups and 24px between major sections.
  The shell owns a single content inset: 16px, increasing to 24px at viewport
  widths of 1024px and above in the desk workspace. Instructor keeps 16px.
  Do not add another page frame.
- Preserve labelled controls, visible focus, 44px touch targets, readable
  contrast, keyboard operation, reduced motion and wrapping at narrow widths.
- Every mutation authorizes by a named permission, validates and guards before
  writing, audits the change atomically, then revalidates. Never check role names.

## Shared foundation

`globals.css` imports Tailwind, motion utilities and the independent shadcn
tokens. Its font and type scale have no external theme dependency. CSS Modules
use Tailwind's 4px `--spacing` scale for geometry. Each status tone has explicit
light/dark foreground and background tokens.

The logo's blue is the accent for primary actions, selected navigation/tabs,
checked controls, progress and keyboard focus. Use the shared primary and
brand tokens, not blue values at call sites. Light mode uses a deeper blue
with white labels; dark mode uses a lighter blue with dark ink. Selection uses
a soft blue surface and readable blue text. Workspace surfaces, ordinary hover
states and status colours keep their existing meanings.

Inputs and textareas retain their shadcn focus ring without a second global
outline. Command searches mark focus with a two-pixel blue line along the
whole search row, keeping the inner input inside the row's bounds. Forced-colour
mode uses a system-colour outline so focus remains visible without shadows.

The root layout reads `swimly.theme` and sets `data-theme` before first paint.
The appearance provider updates that attribute and cookie. With no explicit
mode, CSS `color-scheme: light dark` follows the device. The account RadioGroup
offers System, Light and Dark; the appearance button flips the resolved mode.
Sonner notifications share these tokens; errors remain until dismissed.

The [interaction system](docs/interaction-system.md) records the screen audit
and shared feedback contract. `motion.css` defines 120ms feedback, 180ms
component and 240ms surface timings with explicit transition properties.
`LoadingButton` reserves both labels to prevent layout shifts; `IconButton`
adds keyboard-accessible guidance. Form feedback associates server errors with
fields, focuses the first failed field after submission and preserves typing
focus during correction. Keep essential instructions visible and operational
pages, rows and static cards stationary.
Microinteractions move only control contents: selection marks settle, loading
labels crossfade, destination chevrons nudge and appearance icons transition.
Buttons have a small press response. Reduced motion removes those movements
while preserving immediate state feedback; do not introduce page-entry motion.

The supplied app logo lives at `public/brand/app-logo.png`. `AppLogo` renders it
through Next Image in the desk navigation, sign-in and pool-deck home control;
the same asset supplies browser and touch icons. Preserve its transparency and
colours in both themes, with accessible names supplied by adjacent text or links.

The desk workspace uses shadcn Sidebar, Sheet, DropdownMenu and Command/Dialog.
Its inset Sidebar places navigation on the Neutral workspace canvas and wraps
the page in one rounded, subtly elevated surface, with an 8px outer gutter on
tablet and desktop. Desktop pages start directly with their content: collapse,
site switching and swimmer search live in the sidebar header; appearance and
account controls live in its footer. The collapsed rail keeps icon controls
with accessible names. Sidebar controls and links share aligned 12px side
insets and 44px rows; site/search controls are grouped with an 8px gap above a
separator. Navigation sections have 24px separation, Setup children are
indented, and the navigation region scrolls independently even in the icon rail.
Sidebar hover/focus uses its own Neutral token so it remains visible against
the inset canvas. Navigation icons nudge without moving labels; the current
page retains a distinct surface and border in expanded and collapsed modes.
Content uses a 16px inset, increasing to 24px from 1024px.
Phones use a full-width surface, a compact navigation/site/appearance strip,
and Sheet navigation containing swimmer search. Canvas and surface tokens adapt
to both themes; this framing is scoped to the desk workspace.
It owns the main landmark, skip link, mobile navigation strip, scroll reset, collapse
preference and mobile navigation. Data pages, including swimmer profiles, fill
the available width. Account caps at 768px, Together at 960px, and programme
details at 1152px. Instructor remains a separate workspace, described below.

## Screens

Schedule keeps its booking sheet with sticky level labels and horizontal time scrolling.
The sheet expands vertically within the workspace's single page scroll. Phones
use Agenda. Circled check means spaces available; circled X means full.
Attendance completion never determines these icons. Agenda mixes classes and
dated, non-cancelled assessment sessions chronologically for the sidebar's selected
site, including every pool area and instructor. Assessment links require the Assessments screen.

Swimmers is a shared directory across sites, with surname sorting, stable
pagination, member number and age for disambiguation. Search matches names,
member numbers and contacts. All/Active/Inactive filters and profile return
links retain validated URL state. Sidebar swimmer search stays available here
as on every desk page for users with access to Swimmers.
Its header is separated from search by 24px; search, filters and results use
16px gaps. Classes also uses 24px between its major page sections.

The swimmer profile shows enrolment chapters, attendance, assessments and
individual competency history. The current-state rail stacks on narrow screens.
Historical snapshots are distinguished from structured before/after audit
evidence. Draft competency changes survive tab switching. Editing and enrolment
dialogs preserve named permissions and atomic seat/audit checks.

Profile enrolment and move dialogs use a wide, responsive class list with site,
level, day, start-time and availability filters. Moves start at the swimmer's
pinned level; All sites remains available. Rows show the actual duration, pool,
instructor and spaces. A fixed footer keeps the selected destination visible,
including when filters hide it, and identifies a change of site. Full classes
cannot receive a move; new enrolments retain the explicit waitlist option.
Placement reasons and server review, capacity and permission checks still apply.

Classes is a searchable weekly directory across live sites. Site, Level and Day
filters are prominent; advanced filters include Programme, Time, Instructor and
Pool area. Availability describes capacity. Full class details, enrolment,
waitlist actions and the desk teaching flow use the same shadcn components.

Assessments uses two linked pages under its sidebar entry: Upcoming assessments
and permission-gated Assessment setup. Session
details focus on bookings and outcomes; dates, capacity and parent publishing
live on the session's setup page. Awaiting enrolment has its own sidebar entry
and screen grant. The searchable, paginated list combines pending placements
and class waitlists, grouping by swimmer and programme with each requested class
visible. It offers family contacts, matching classes for placements and confirmed
waitlist promotion when a space is available. Both lists re-home secondary
columns on phones and retain 44px actions.
See [assessment workspace](docs/assessments.md) for queue rules and verification.

Together, Activity, Programmes and levels, Staff, Roles,
Clubs, Account, sign-in and loading states also use this shared foundation.
Responsive tables re-home secondary columns as supporting lines.

Parent accounts also contains the shared parent-link request queue: pending,
approved and declined filters; explicit swimmer matching across sites; and a
parent-visible reply separate from the internal audit reason. Requests do not
grant access until staff approve. The queue uses paginated reads and the same
parents.manage permission as the profile controls.

Parent access is a permission-gated swimmer profile tab with email/status rows
and explicit approve, revoke and restore dialogs. Swimmers links to Parent
accounts, an exact email search followed by account details and a reasoned
suspend/reactivate dialog. Assessment session setup includes Booking in LeisureWorld Aquatics with
publication status, Ireland-time deadline editing and unpublish. The controls
use shared form feedback and shadcn status tones; each write records a reason.
These controls remain in the desk workspace. See [staff parent controls](docs/parent-staff-controls.md).

## Forms, search and confirmation

The authenticated help centre owns a separate document frame at `/help`, using
the same typography and theme. The desk sidebar and phone toolbar open Help in
a new tab. Instructor opens `/help/instructor`, with teaching-only guides and a
return to Classes. Search and topic navigation lead to full guides with numbered
steps, troubleshooting and related tasks. Captioned screenshots beside the steps
use synthetic records, fit the available width and open at full size in a new
tab. Their image URLs require a staff session too. Topic navigation collapses on phones;
articles have a contents rail on wide screens. Task links respect screen access,
and the manual reads no operational data. See [help content and access](docs/help-centre.md).

`src/components/ui` composes shadcn inputs with labels, hints and native form
submission. Dates, times and numbers preserve native validation and bounds;
uncontrolled inputs and textareas retain native reset behaviour. Named switches
post `on` only when checked. Selects retain empty choices and grouped options.

SearchablePicker uses Command/Popover for locally available option sets.
StudentSearch asks the server after a 200ms debounce, excludes already chosen
swimmers, respects the active/inactive scope and drops stale results. It sends
only the selected ID in the parent form. Workspace search uses CommandDialog.

FormDialog keeps fields mounted after failure, scrolls the fields with actions
visible, blocks duplicate submits and retains server-requested confirmation
data. Success closes the dialog and restores trigger focus. ConfirmAction uses
AlertDialog with rich descriptions and closes only after a successful action.
Image fields preview locally and upload only with the parent form's Save.

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

**Reads respect screen access.** Pages require their screen grant; setup pages
and the activity log also require their named permissions. Mutations enforce
their own permissions regardless of which controls are visible. Instructor
records additionally require the confirmed owner of that dated class.

**Administrators always have full access** (owner confirmed 13 September 2026).
Holding both `staff.manage` and `roles.manage` defines administrator access;
neither permission alone does. `expandPermissions` and `visibleScreens` resolve
the full current catalogues, so existing administrators receive newly added
capabilities without a data update. Names and the legacy `User.role` enum never
decide this. Role previews use the previewed grants, and demotion or deactivation
takes effect on the next request. The role editor shows inherited access and
keeps the two management grants editable. Their removal returns to the role's
stored selections. Instructor's separate navigation and class ownership checks
still apply. Desk landing links filter workspace destinations after expansion.

**Nothing may leave the app without a keyholder.** `staff.manage` and
`roles.manage` are load-bearing — lose either across every active account and
the way back in is a database console, because `prisma/seed.ts` declines once
an admin exists. `src/lib/staff/keyholders.ts` refuses any edit that would do
it, by computing what the world would look like afterwards rather than by
counting role names: keyholders can hold administrator access or separate grants.
It deliberately sits outside a `"use server"` file, because every export from
one of those is an endpoint the browser can call.

**Nothing refers to a role by name.** Not the code, not the nav, not the seed.
That is what lets a club rename or delete every role the app shipped with.

**A role also says which screens exist.** `StaffRole.screens` holds keys
from the catalogue in `src/lib/staff/screens.ts`, one per top-level page.
Administrators inherit all screens; for other roles the nav shows only those
granted. Every page under the shell opens with
`screenPage(screen, permission?)` and 404s for anyone whose role does not
name it; a link that crosses into another screen asks `canSee` before it
renders. Permissions are still the power to change something — screens are
what is on the menu at all. That is how an instructor role is given Instructor
and nothing else: the deck becomes their whole app. Account is never on the
list because it is always there. The keyholder guard checks screens too:
nobody may remove the last usable grant for Roles or Staff.

**A role also says where its day starts.** `StaffRole.home` is a key from the
`ROLE_HOMES` map in the catalogue file — Schedule for the desk, Instructor for
an instructor. The sign-in form pushes to `/start`, which reads the role and
redirects; the wordmark goes to the same place. A configured home that is not
accessible falls back to another screen the role may open.

Overview is retired. `/` now only redirects to an authenticated, accessible
home, as `/start` does. Schedule is the preferred fallback, then an accessible
screen, then Account. Old `overview` screen grants are ignored; old home values
normalize to `calendar`. The legacy database default remains compatible while
new role forms and seeds explicitly save the selected home. Instructor-only
roles retain their isolated destination. Overview's summary queries are removed.

Analytics lives in Monitoring as a separate shadcn dashboard. Its bento grid
uses three headline totals, a larger programme/level breakdown, and supporting
monthly cancellation and daily activity cards. Exact labels accompany the
level bars showing enrolled places divided by that level's total class capacity;
a table gives seven days of activity without relying on colour.
Site selection stays in the sidebar; the page offers refresh. Loading, empty
and error states use shared primitives.
It inherits the workspace spacing and blue accent. See [metric definitions
and access](docs/analytics.md).

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

LeisureWorld shares swimmer identity, contacts, curriculum and earned progress
across its sites. A Club owns classes and dated assessment sessions. The
cookie-backed working area filters the timetable; it does not restrict swimmer
search or profile access. Switching sites keeps the current page and selected
swimmer. Staff permissions continue to apply by name.

Enrol, transfer and move-up pickers offer a site filter, list both sites and
name the destination. A transfer locks both classes and the swimmer, rechecks
capacity, ends the old enrolment and creates a new history row. Cross-site
transfers write activity at both the source and destination. Attendance stays
with the class and date where it happened.

Reception is retired. Its former screen key is ignored and its former home
uses the normal accessible-screen fallback. The old route redirects to the
selected swimmer or Swimmers list only with existing Swimmers access;
otherwise it uses that same home fallback. No role gains another screen.

Original Student.clubId and Programme.clubId values remain as registration
provenance. Additive sharedWithId links on Programme, Level, Competency and
AssessmentType retain historical IDs while providing one shared catalogue.
The migration links only exact normalized names within the same shared parent;
unique definitions remain available. Names do not determine equivalence at
runtime, so renames preserve progress. Catalogue writes resolve old IDs and
check shared name uniqueness under one transaction lock.

Marks recorded against original copies resolve to the latest updated judgement,
retaining the assessor, assessment date and note. Completion snapshots remain
unchanged and count across equivalent levels. All progress mutations lock the
swimmer; clearing a mark or revoking completion handles every original copy
and is audited. No swimmer records are merged by name. Programme copying is
retired because every site uses the shared catalogue.

[docs/shared-sites.md](docs/shared-sites.md) records the upgrade and verification procedure.

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

**4. Classes are rolling and weekly.** Attendance is keyed on
`(course, date, student)`: the weekday must match, the date cannot be in the
future and the swimmer must belong on the register. Dated cancellations now
live deliberately in `ClassCancellation`, not in a note or on the recurring
class. The record freezes the class details and affected roster for billing.
Cancellation, class starts and teaching saves share the course lock; a
cancelled occurrence cannot accept later teaching saves. `ClassNote` remains
free text. See [Duty manager](docs/duty-manager.md).

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

### Teaching is confirmed, exclusive and recorded

Every instructor confirms Start class before opening a class on the deck,
including their own scheduled classes. Confirmation creates a ClassCover row
for that class and date and an audit entry in the same course-locked
transaction. The existing unique course/date key guarantees one owner. A retry
by that owner is idempotent; another instructor cannot replace the claim. A
claim remains locked if its owner's account is deleted.

The deck shows Start class, Open class, or In progress. Attendance saved/to-take
is a plain operational indicator for the owner. Cover attribution stays in the
audit trail and desk records. Attendance, competencies and completion recheck
ownership in their save transaction, while the class page checks it before
loading swimmer data. Desk transcription retains attendance.markAny; it does
not grant teaching access in Instructor.

### Batched writes, on purpose

The register and the assessment checklist each save as **one action carrying
the whole class**. Next dispatches Server Actions one at a time per client, so
a save per tap would queue on poolside wifi. Batching also means a dropped
connection leaves the marks in the tab and retryable, and the register mirrors
itself, including its class note, into `localStorage` so drafts survive a closed
tab when browser storage is available. A warning explains when it is not.
Register drafts are scoped to class and date; deck checklists remount when the
class, date or level changes, while refreshes of the same record preserve edits.
Hung saves restore a retry path after 15 seconds; a timeout does not cancel a
server action, so the UI says the save is unconfirmed. Neither writes an
audit row when nothing changed — the existing rows have to be read to build the
diff anyway, so a "did that save?" re-submit costs nothing.

Attendance saves also carry the revision the instructor opened. That revision
is derived from the class/date, saved marks and class note; it needs no schema
column. The action reads and checks it under the same course lock used for
enrolment and cover, then writes the register and audit together. If another
person saved a different version, the action returns the saved values without
writing. A focused shadcn Alert compares the saved register with the draft;
the instructor can use the saved register or explicitly save their version.
A second intervening save is checked again. An identical retry succeeds without
rewriting records or adding audit rows.

Version 2 browser drafts keep that original revision through refreshes and
reloads. Older drafts remain readable, but need the comparison step before they
can replace a saved register. Discarding a draft explicitly loads the saved
version and refreshes the roster.

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
src/components/ui-kit/         shared shadcn compositions — tag, page-header,
                               empty-state, app-shell
src/components/ui/             shadcn compositions for native form submission
src/components/                feature components composed from shadcn
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
in the comment at the top of `src/lib/action-result.ts`. Persist the mutation
and its audit entry through the same transaction. Capacity and keyholder guards
must also run under their shared locks, after reading the current rows.

Errors a person can fix are return values (`{ ok: false, error }`), rendered
next to the field. Throwing is for "this should not have been possible".

### Scripts are part of the product

Idempotent, self-disabling, audited, and deliberate when destructive.
`prisma/seed.ts` is the reference implementation: it declines once an admin
exists, matches on the email so a second run updates rather than duplicates,
and writes an audit row for the account it creates.

---

### Instructor workspace boundary (11 September 2026)

The owner specified Instructor as a dedicated tablet experience on the pool
deck, isolated in both directions from desk work. Its route group is
`src/app/(instructor)/instructor/`, outside the desk `(app)` layout. Its shadcn
frame contains classes, site switching, appearance and sign-out. The entire
Instructor surface now uses shadcn Button, Item, Dialog, RadioGroup, Select,
Collapsible, Alert, Label and Textarea. The shared teaching forms retain drafts,
retry handling, audit and concurrent-save comparisons. Scoped CSS makes every
pool-deck control at least 44px, including browsers reporting a mouse. The
independent Neutral ui-* tokens follow the shared theme provider.

The Instructor class page has its own server loader. It checks site, active
class and the confirmed class/date claim before reading attendance or swimmer
competencies. It never offers desk class or swimmer profiles, even to accounts
granted both screen sets. Start confirmation is required for scheduled and
cover instructors alike. Only the confirmed teacher can open or save the class
in this workspace. Legacy desk actions also reject deck-only callers without
the teaching context. Desk transcription remains available in its own
workspace. Old deck bookmarks redirect to the isolated route, preserving date
and step. Development-only role preview remains a testing tool.

See [docs/instructor.md](docs/instructor.md) for the flow and verification.

## Checking your work

- Actual shadcn controls, semantic headings and Lucide icons; one H1 per page.
- Every status comes from a domain metadata map and reads in both themes.
- No undefined theme variables or colours outside the app tokens.
- Text contrast at least 4.5:1 and control edges at least 3:1.
- Visible keyboard focus, working skip link, reduced motion, labelled controls.
- 375, 768, 1024 and 1280 in light and dark: no page overflow, 16px page insets
  increasing to 24px from 1024px for desk pages, reachable navigation and 44px
  touch targets. Secondary columns wrap or collapse.
- Dialogs trap/restore focus, preserve values on failure and prevent duplicate
  submissions. Native FormData, required fields and reset still work.
- Instructor stays isolated; permissions, audit, claims and capacity guards hold.
- Typecheck, lint, relevant tests, browser checks and an optimized build pass.
