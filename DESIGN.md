# Swimly — the doctrine

Swimly is built in **the well-kept page** style: a workspace that reads like a
carefully maintained document, not a dashboard. White content ground, a
warm-grey sidebar, soft dark-brown ink instead of black, hairline borders
instead of shadows, and one blue accent spent only on interaction.

The system itself lives in this repo as a git submodule at
`.claude/skills/design-kit`, which is also a Claude Code skill — ask for "the
house style" and it loads. Read it before making a visual or architectural
decision; this file records only what is **specific to Swimly**.

```
.claude/skills/design-kit/SKILL.md                     rules, setup, judgement calls
.claude/skills/design-kit/references/design-system.md   colour, type, layout, components
.claude/skills/design-kit/references/architecture.md    actions, permissions, audit, scripts
.claude/skills/design-kit/references/recipes.md         page, table row, dialog, filter bar
```

Update it with `git submodule update --remote .claude/skills/design-kit`.

---

## The rules, non-negotiable

These are the ones that get broken first, and breaking any of them is what
makes Swimly stop looking like itself.

- **No KPI cards, hero metrics or stat tiles.** Numbers live in prose
  sentences with bold counts, and in lists. The overview page is the worked
  example.
- **One blue, for interaction only.** Buttons, links, active states, focus,
  caret, selection. Never a decorative fill or a background tint.
- **Status colour comes only from the nine tint pairs**, always as the pair
  (soft field + deep same-hue ink), always via a metadata map — never a colour
  chosen at a call site.
- **Flat at rest.** Only genuinely floating layers cast a shadow: dropdowns,
  popovers, dialogs, sheets, toasts.
- **One H1 per page**, 26px bold, with an optional muted description line.
  Section headings stay at 14px semibold.
- **Collapse, don't scroll.** Secondary table columns re-home as a muted second
  line below `md`. Anything that grows without limit goes behind a searchable
  picker.
- **Every mutation is audited**, scripts included, with a summary naming what
  changed and to what.
- **Ask the permission tier, not the role.** `canManage(role)`, not
  `role === "INSTRUCTOR"`.

---

## Decisions taken for Swimly

### Light only, on purpose

The kit ships a `.dark` block it is honest about: the app it was extracted from
never rendered dark mode, so that block is derived rather than proven. Swimly
has **deleted it** and ships one mode.

The `@custom-variant dark (&:is(.dark *))` line stays in `globals.css` so the
shadcn primitives' `dark:` utilities still compile — they simply never match,
because nothing ever sets `.dark`. That is the difference between a decision
and an oversight: the app the kit came from carried an unmounted dark theme for
its whole life without anyone looking at it.

To take dark mode on later: copy the block back from
`.claude/skills/design-kit/assets/globals.css`, mount a theme provider, switch
`<Toaster theme="light" />` in `src/app/layout.tsx` back to `system`, and
verify it on real pages at more than one width before shipping it.

### The accent stays the kit blue

`--primary: oklch(0.6 0.14 250)`. A swim club is not the place to fight the one
blue. If Swimly is ever rebranded, that token is the whole change — and the
neutrals keep their trace of yellow (hue 95–106), because that warmth is what
makes the result read as paper rather than as an unstyled admin panel.

### Three roles, three tiers

`Role` in `prisma/schema.prisma` is the source of truth, and
`src/lib/authz.ts` maps it onto the three tiers:

| Role | Tier | Owns |
|---|---|---|
| `ADMIN` | admin | Programmes, levels, competencies, courses, accounts — **the rules** |
| `INSTRUCTOR` | manage | Students, enrolments, attendance, assessments — **the data** |
| `VIEWER` | view | Reception or a duty manager: looks things up, changes nothing |

The split matters more than the names. Without it the rename alone would leave
an instructor able to rewrite the curriculum: the timetable and the ladder are
rules, and what happened in the water on Tuesday is data.

Adding a role without placing it in a tier is a type error, which is the point.
If a role's tier is genuinely ambiguous, that role is doing two jobs.

Two things sit on top of the tiers as **scoping rules inside actions**, not as
a fourth tier:

- **An instructor may only take the register and assess for classes they are
  assigned to.** Admins may act on any. `canMarkRegister` in
  `src/lib/attendance/access.ts` is the whole rule; relaxing it for cover staff
  is one line there.
- **Completing a level with gaps is admin tier**, and needs a reason. Placing a
  swimmer at a level they have not earned is *not* — see below.

Guard the same rule in three places, because they answer different questions:
the **nav** hides what you can't reach (`visibleNavItems`), the **page** hides
the button (`src/lib/page-guards.ts`, which 404s rather than erroring), and the
**action** refuses the call. Only the last one is security.

The session is re-read from the database on every `auth()` rather than trusted
from the token, so deactivating an account or demoting a role takes effect
immediately instead of at token expiry. It costs one indexed query.

### The nav holds only pages that exist

A sidebar advertising routes nobody has built reads as a broken app, so add the
item in `src/lib/nav.ts` in the same change as the page.

### Auth is credentials-first, and swappable

Sign-in verifies an email and a bcrypt hash against the `User` table. Nothing
downstream knows that: every screen and action asks `session.user.role`, so
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

### Placement is manage tier, with a reason on the row

Placing a transfer-in or an adult beginner out of sequence is routine and
weekly. Making it admin-only would produce one of two things — the front desk
gets made admin and the tiers stop meaning anything, or somebody fakes a
completion to get past the guard and the progression data starts lying. So
`enrolStudent` takes a `placementReason` and stores it **on the enrolment**,
not only in the audit log, because the log is admin-only and the instructor on
the deck is exactly who needs to know why this child is in Level 5.

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
src/lib/authz.ts               three tiers and the require* guards
src/lib/page-guards.ts         the page-level versions, which 404 rather than throw
src/lib/audit.ts               logAudit — pass the tx client when it must be atomic
src/lib/action-result.ts       the result type and the six-step action shape
src/lib/format.ts              the pinned formatters; the only place a date is built
scripts/                       one-off work, run with tsx, held to the app's rules
```

The domains, and who may write to each:

```
curriculum/    Programme, Level, Competency          admin
courses/       Course                                admin
students/      Student                               manage
enrolment/     Enrolment, waitlist, the seat lock    manage
attendance/    AttendanceRecord, ClassNote           manage, own classes only
progression/   CompetencyResult, LevelCompletion     manage; overrides are admin
               rules.ts — pure, neither read nor write
activity/      the audit log                         read-only, admin
staff/         User                                  admin
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

- One H1, and the numbers are in a sentence rather than in tiles.
- Every status is a `<Tag>` fed by a metadata map.
- Nothing at rest casts a shadow; every border is a 1px hairline.
- Blue appears only where something is interactive.
- Row actions carry `aria-label`s naming the verb and the row, and stay
  reachable on touch (`max-md:opacity-100`).
- Secondary columns collapse rather than scroll below `md`.
- Every mutating action authorizes first, guards before writing, audits after,
  and returns `{ ok: false, error }` for anything a person can fix.
