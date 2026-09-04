# Swimly — UX pattern inventory

Produced by Intent's extract mode on 4 September 2026, from the source of
every screen under the signed-in shell plus the sign-in page. Companion to
[MASTER.md](MASTER.md) (how it looks) and `DESIGN.md` (why it is built the
way it is). This file is about how the product behaves for the people using
it, and what to fix next.

## Patterns in use

**Structure**
- Every page: one H1 with a muted description, a "stat sentence" instead of
  metric tiles, H2 sections, lists in a bordered container. Same grammar
  from Overview to Clubs.
- Tabs, filters, grouping and pagination all live in the URL as links. Back
  works; a link can point at a view. No client-side tab widgets.
- Tables collapse secondary columns into a second line under `md` rather
  than scrolling sideways.
- Detail pages open with a back link naming the parent (Students, Courses,
  Today), then the header.
- Every page has a page-shaped loading placeholder from one shared file.

**Actions**
- One form dialog component for every create/edit. Failure keeps the dialog
  open with one sentence beside the fields; success closes it with a toast.
- One confirm dialog for anything that takes something away, with a
  description that says what is lost and what survives. Destructive variant
  for the irreversible.
- Nothing is deleted. Courses, programmes, levels, competencies, clubs and
  assessment kinds are archived; staff and swimmers are deactivated. Every
  archive says what stays readable.
- Row actions are icon buttons with `aria-label`s naming the verb and the
  row. Hidden until hover on desktop, always shown on a phone.
- Anything that grows with the club (swimmers, classes) is picked through a
  searchable picker, never a long select.

**The deck**
- Today knows the time: Now, Next, Earlier folded. One button per class.
- The class page is two steps: attendance, then competencies, then back.
- Attendance starts everyone absent; marks are held locally behind one
  Save, mirrored to the device, so a dropped connection loses nothing.
- Competencies are marked one competency at a time across the class, two
  big buttons per swimmer, one save for everything.
- Cover is self-declared: opening a colleague's class asks "are you taking
  it?" and the answer is written on the record.

**Trust and control**
- Every mutation writes an audit row with a name and a summary in words.
- Permissions are asked by name, never a role name. Roles say which screens
  exist, which permissions they hold, and where the day starts. An admin
  on a dev build can see the app as any role.
- Two sites, one app: every list is one club's; a detail page from the
  other club says so and offers the switch.
- Medical notes are a red flag on the row with the detail one tap away,
  never in a list; the profile shows them above everything else.

## What works, and why

- **User autonomy is respected everywhere.** No prechecked boxes, no fake
  urgency, no guilt copy, no hidden costs, no nagging. Every destructive
  action is confirmed with honest consequences. Nothing in the anti-pattern
  catalogue, categories 1 to 8, is present. That is rare.
- **Designed for real conditions.** 40 to 44px targets on a phone, light
  and dark one tap away, saves that survive lost wifi and closed tabs, a
  sticky save bar clear of the home indicator, one-sentence errors.
- **Intent is visible.** The stat sentence says what matters today. Tags
  say the state of every row. "Placed here: <reason>" tells the instructor
  why a child is in Level 5. Cover is named on the row, not inferred.
- **Systems over screens.** The audit trail, the seat lock, and archive-
  not-delete mean the past never gets rewritten by an edit to the present.
- **Plain words, the club's words.** Swimmer, class, level, competency,
  register, cover, placement. British spelling. Short sentences in every
  empty state and hint.

## What fails, or rubs

Ranked. Severity uses the Intent scale.

1. **A 404 with nothing on it.** (Dead End, category 9, Medium.) A screen a
   role does not have, or a wrong link, shows the bare Next.js "404" inside
   the shell. No sentence, no way home. There is no `not-found.tsx` and no
   `error.tsx` under the shell, so a thrown error is the framework's page
   too. Instructors with a Today-only role will hit this from any old
   bookmark. → `/fortify`

2. **Two words for one thing, still.** (Inconsistent Patterns, category 9,
   Medium.) The deck says "attendance"; Overview says "registers are still
   to take" and "Take Attendance" in Title Case; the course page says "Take
   Attendance" and "Assess"; the class page says "Competencies"; the nav
   says Students and Courses while every sentence says swimmers and
   classes. Staff with a second language pay for every synonym.
   → `/articulate`

3. **Overview has its own Today.** (Inconsistent Patterns, Medium.) The
   Overview's Today section lists classes with an older button pair that
   goes to the register page, not the class page. Two paths to the same job
   with different screens at the end. Either the Overview section should
   use the same Start class button, or it should be a single line linking
   to Today. → `/journey`

4. **Hover-only row actions on desktop.** (Recognition over recall, Low to
   Medium.) Edit and archive icons are invisible until the row is hovered.
   Keyboard users get them on focus and phones always see them, so it is
   discoverability, not access. A first-timer at the desk may not know a
   row can be edited. → `/wireframe` or accept as a house rule

5. **Account page does not say which screens you have.** (Assumption of
   context, Low.) It lists permissions. Since roles now also decide screens,
   "what am I allowed to do" is half-answered. → `/articulate`

6. **No offline signal on the deck.** (Design for real conditions, Low.)
   Marks survive a dropped connection, which is the hard part, but nothing
   tells the instructor the list they are looking at may be stale or that a
   save is waiting. → `/fortify`

7. **No way back in without an admin.** (Trade-off, noted not scored.) There
   is no password reset; an admin sets a new one and tells you. Deliberate
   and safer, but an instructor locked out at 7pm has no path. Worth a line
   on the sign-in page saying who to ask.

## What is missing

- A not-found page and an error page inside the shell, in the product's
  voice, with a way to Today or Overview.
- A vocabulary list, one word per thing, applied across nav, buttons and
  sentences. The pieces exist in PRODUCT.md; the app has not been swept.
- A stale-data or pending-save indicator on the deck.
- Screens listed on the Account page.

## Manipulative patterns

None found. Checked against all ten categories of the Intent catalogue,
including AI-specific patterns (there is no AI in the product) and process
pathologies (personas and journeys in PRODUCT.md are drawn from confirmed
needs, dated, and hedged where unconfirmed).

## Suggested order

1. `/fortify` — not-found and error pages, offline signal.
2. ~~`/articulate` — one word per thing, sweep every screen.~~ Done 4 Sep
   2026: swimmer, class, attendance, marks. List in PRODUCT.md.
3. ~~`/journey` — reconcile Overview's Today section with the deck.~~ Done
   4 Sep 2026: Overview's rows open the same class page as the deck.
4. `/evaluate` — re-check after the three above.
