# Swimly — design and implementation

The staff app uses **shadcn/ui** and a cookie-backed light/dark/system appearance
preference. **The whole app uses Poolside Clear v2** (owner decisions, 27 September and
3 October 2026): Plus Jakarta Sans, the fin logo's blue for actions, selection and focus, a
cool canvas inside a rounded frame, white borderless panels of separate rounded rows, pill
controls, and a deep pool-night dark mode. Its tokens and system rules live in
`src/app/docs/poolside.css`, scoped to `.turnfin-app`, which the root layout puts on `<body>`;
the root layout also loads the typeface. The earlier Docs theme (`brand.css`) is retired:
no other stylesheet defines theme tokens. The swim school, the home page, Docs, Refunds,
Training, HR, Rota and Admin share one frame, `ModuleShell`; the pool deck, Help and the
sign-in pages use the same top bar parts (`tf-*` classes) without the module bar. Earlier
mentions below of Figtree, "Neutral surfaces", sidebars or the Reception Portal's Inter
theme describe the retired look. Components live in `src/components/shadcn`.

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
- One H1 per page. The Poolside type scale (`--pc-text-*`) is 28px page titles (24px on
  phones), 18px section titles, 14px body, 12px captions and metadata, and 28px figures;
  markup uses only `text-xs`, `text-sm`, `text-lg` and `text-2xl`; `text-base`, `text-xl`
  and `text-3xl` are mapped only as a safety net. Every control is
  `--pc-control-height` (44px) at every width. Fields keep 16px text on touch so phones do
  not zoom on focus.
- Default gaps are 16px between panels and 8px between rows in a panel; panels have a
  24px inset. The frame owns the page inset (24px around the frame and inside it, none
  on phones, where the frame becomes the page). Do not add another page frame.
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

The Turnfin fin (`public/brand/turnfin.png`) is the only brand mark, everywhere: the top-left
of every frame, linking home, above the sign-in panel and the 404 page, and the browser and
home-screen icon (`src/app/icon.png`, `src/app/apple-icon.png`, Next's file conventions; no
layout or page sets `icons`, which would turn the file icon off). Tab titles read
"<page name> · Turnfin": the page name is its H1 without the working-site suffix, record pages
use the record's name (never a child's), and any layout that sets a title also sets
`TITLE_TEMPLATE` from `src/lib/app.ts`. The ground behind the frame (the body background) is
`--pc-outer`, and `--pc-canvas` below 768px; the viewport theme-color repeats that pair.

**The frame** (`ModuleShell`, DESIGN v2, 3 October 2026): on the outer canvas, one rounded
frame holds a top row (the fin; the module's pages as a pill bar, the current page filled
blue; and a tools bar on the right: search, then the working site, "View as" in dev builds,
and the account menu), then the
person's modules as an icon rail down the left (each names itself on hover and keyboard focus)
beside the page. The bar shows as many page links as fit (measured, `useBarFit`) and puts the
rest under "More", grouped under their group names; More keeps its short name and is filled
when it holds the open page. The bar never scrolls: until measured, links that do not fit wrap
out of sight. A module with one page has no page bar (its scope note is still read out). From
768px to 1099px the page bar takes its own row, lined up with the page (past the rail with a
mouse, at the page's edge on touch). On phones and touch screens the rail becomes a labelled
bottom bar, at most 480px wide: Home, three modules with the current one always shown, and
More, or Help itself when no module is left over. Its items share the width equally and a long
name wraps to two centred lines, never clipped or overlapping; only the current module is blue.
- The working site picker (`ClubSwitcher`, the same on Home, Swim school and the pool deck) shows
  the building, the site's name in full (truncating only past 28 characters) and a chevron; on
  phones it is a 44px building button named "<site>, change site". Its menu is "Working site";
  the toast reads "Now working at <site>". Building2 means only the site; Admin uses Settings.
- The account menu (`AccountMenu`, V2Home-menu) opens from the 32px avatar and chevron, named
  "Account menu: <name>". It is a 320px panel (24px radius, 16px padding and gap, no
  separators): the 40px primary-soft avatar beside the name at 600 and a "<role> · <site>"
  caption (the worn role in View as; both from the root layout through `useYourAccount`); the
  "Appearance" caption over a pill segmented row (System, Light, Dark; menu radio items, so
  arrow keys reach them, `.tf-seg`); then Manage account and Sign out as 44px pills at 600 with
  a sunken fill when highlighted. Help is not in it: it sits in the rail, the bottom bar's More
  and the deck bar. The pool deck uses the same menu without Manage account.
- `aria-current`: "page" only on the page bar link for the exact page; "true" on a page link
  that is a parent of it, on a filled More and on the current module in the rail and bottom bar.
- Focus on a filled (current) item is a ring with a surface gap (`::before`, or the bottom
  bar's icon pill) over a transparent outline, so it shows on the blue and in forced colours.
- One skip link, `.skip-link` in poolside.css: "Skip to content", a 44px blue pill at the top
  left once focused, above the bottom bar.
- The frame's radius is `--pc-radius-frame` (36px); the bottom bar's shadow is
  `--pc-shadow-overlay`.

The pool deck keeps its own top bar (fin, Classes and Swimmers, site, help and the shared
account menu without Manage account)
and no module bar; see docs/instructor.md.

## Screens

Docs at `/docs` is in the shared frame: Overview (titled Docs, like every module),
Document library, My work, and Reading reports and Administration for those who may open
them, with a search shortcut in the tools. The Docs reading and authoring layouts in
`docs.css` keep their structure under the v2 tokens; the editor toolbar wraps rather than
scrolling sideways. See [Docs integration](docs/turnfin-docs.md).

**The home page** (`/`, owner decision 28 September 2026) is the role's workspace: the role's
home name as the H1, with the date, role and working site beneath and a "things need you"
tag. Then **Classes today**, a timeline of the day's sessions by pool area (half-hour
columns, a line at the current time; each session a block whose state comes from
`HOME_SESSION_META` with a label and icon, so colour is never the only signal; on phones a
short "On now and next" list instead), then **Waiting for you** (needing-you rows first,
the first one highlighted), **Today at <site>** (figure tiles) and **Quick actions**, with the
Turnfin Me note. Each module supplies its items (`registerHomeCard`); an item's `kind`
(`action`, `today`, `timeline`) or `count` decides its section, and the shared pieces live
in `src/components/home/home-parts.tsx`. Keep it to the everyday jobs and to figures the
person may already see.

**A module's first page is its overview** (`ModuleOverview`, 29 September 2026) where the module
has no natural one: Swim school (`/swim-school`), Rota (`/rota/overview`) and Admin (`/core`).
The module's name and one line as the H1, its quick actions, Today, Waiting for you (the same
items it gives the home page, so the two agree), and **Everything in <module>**: one panel of its
pages as grouped rows (icon, name, one line on what it is for), two columns when wide. "Overview"
is the first link in the module's page bar. Pool deck opens on the deck,
Docs and Training on their own overviews, Refunds on its requests with their summary, HR on its
people search. The module
launcher (`/modules`) and the Reception Portal are retired and redirect to `/`; every shell's
"All modules" link is now "Home". The supplied transparent Turnfin fin logo lives at
`public/brand/turnfin.png`.

Refunds at `/refunds` is in the shared frame with three request views in the page bar
(Refund requests, My requests, My drafts). The summary tiles are the follow-up queues
(Awaiting review, Needs information, Awaiting payment, Refunded): each links to its status
and is outlined in blue when it is the open filter, so each status has one way in. Filters
sit in a white panel; requests are separate rounded rows. On a request, the next-action
panel is the one panel with an edge (2px blue). Statuses use `RefundStatusTag`, which pairs
each label with its own icon. Finance decisions use shadcn Dialogs with 44px controls,
focus restoration and preserved values after errors. `src/app/refunds/refunds.css` only
arranges the Refunds screens. See [docs/refunds.md](docs/refunds.md).

Training (`/training`), HR (`/hr`) and Rota (`/rota`) are people- and site-scoped workspaces
built on the shared frame, `ModuleShell` (`src/components/workspace/module-shell.tsx`), each
with its own page bar. `src/app/workspace/module-workspace.css`
(scoped by `.turnfin-module`, with `module-*` classes) only arranges their screens; a new
module reuses it rather than copying a stylesheet. The theme comes from `body.turnfin-app`, so
every portalled dialog already has it; their form dialogs pass `portalClassName="turnfin-module"`
to `FormDialog` only so the module layout CSS reaches them, and selects inside them are shadcn `NativeSelect`. Statuses use
metadata-fed tags with their own icons (`TrainingStatusTag`, `QualificationStateTag`,
`NoteVisibilityTag`, `ReviewStatusTag`, `RotaWarningTag`). Each person's own side is not on Work at
all: it is Turnfin Me (`apps/me`), a phone-first app in Poolside Clear with a bottom tab bar,
44px controls and the same tokens (copied into `apps/me/src/app/globals.css`), built from plain
semantic elements; status tones come from `apps/me/src/lib/meta.ts`, each with an icon. See
[docs/staff-app.md](docs/staff-app.md),
[docs/training.md](docs/training.md), [docs/hr.md](docs/hr.md) and [docs/rota.md](docs/rota.md).

### Poolside Clear v2 system rules

These rules apply to every screen. Tokens live in `src/app/docs/poolside.css`; never write
a literal size, radius, colour or control height.

**Type.** Five sizes, each with a matching `--pc-leading-*` line height:

| Token | Size | Use |
| --- | --- | --- |
| `--pc-text-caption` | 12px | Metadata, hints, table headers, tags, counts |
| `--pc-text-body` | 14px | Body, controls, field labels, row titles |
| `--pc-text-title` | 18px | Panel, section and dialog titles |
| `--pc-text-page` | 28px (24px on phones) | The single H1 |
| `--pc-text-figure` | 28px (24px on phones) | Summary figures |

- In markup use Tailwind's `text-xs`, `text-sm`, `text-lg` and `text-2xl`; inside the
  scope they resolve to caption, body, title and page. Never use `text-[…]` or
  `leading-*`.
- Weights: 400 body; 600 labels, buttons, row titles, section titles and the H1; 700
  figures. No letter-spacing, except the H1 (-0.01em), and no `tracking-*` utilities;
  labels are sentence case. Times, phone numbers and figures that sit beside one another use
  `tabular-nums`.

**Colour.** `--pc-primary` (blue) marks actions, the current page and selection; focus is a
blue ring with a soft halo. Status colour comes only from domain metadata maps, always with
an icon. Session blocks use `--pc-block-*` with their `--pc-on-block-*` text colour. The
first row needing someone (`[data-first]`) is yellow; empty queues are muted. Every
text/control pair meets 4.5:1 (text) or 3:1 (edges, focus) in both modes.

**Shape.** Controls, bar items, tags and segmented filters are pills (`--pc-radius-control`,
999px). Rows, tiles and nested cards are 16px (`--pc-radius-card`); panels and dialogs 24px
(`--pc-radius-panel`). Panels have no border and no shadow; rows inside them have a 1px
line. Multi-line boxes (textareas, notices) use 16px, never a pill.

**Controls.**
- Every shared Button and field is 44px with a 16px inset and 14px/600 labels (fields
  400). Icon buttons are 44px. Style menu and popover triggers through `.ui-motion-press`
  and `[data-slot='dropdown-menu-trigger']` as well as `data-slot='button'`, because Radix
  `asChild` triggers replace the Button's `data-slot`.
- Bar items draw a 36px pill inside a 44px hit area (`.tf-bar-item::before`).
- Filters between a few views of one list are `SegmentedLinks`
  (`src/components/ui-kit/segmented-links.tsx`): pill links with optional counts and
  `aria-current`.
- Avatars are the shared `Avatar` (`src/components/shadcn/avatar.tsx`) with `initials()`:
  32px by default (bars, inline), `size="lg"` 40px (rows), `size="xl"` 64px (profile).
  Initials are 12px/600 (18px on `xl`) on the sunken fill with a 1px inset line. Only the
  signed-in person's own avatar takes `self` (soft blue fill, no line). Call sites add no
  avatar size, colour or border.
- Meters are the shared `Progress`: an 8px sunken track with a rounded blue bar. Call
  sites may set width and position only, never height, colour or radius.

**Layout.**
- A list is a white panel of separate rounded rows (`.pc-panel` with `.pc-rows`, or a
  shadcn `item-group` / table inside `.tf-main`, which the theme styles the same way). A
  table that is a grid, like the booking sheet, opts out with `data-layout="grid"`.
- Row: the name at body/600, a caption line beneath, counts and a chevron on the right.
- Summary tiles: borderless white tiles, figure at the bottom so a row lines up when a
  label wraps; a tile that filters shows a soft fill on hover and a blue edge when open.
- Page header: H1 and one line on the left, actions on the right aligned to the bottom,
  the primary action last.
- Check every change at 375, 768, 1024 and 1280px in light and dark: no horizontal scroll,
  no clipped labels, no control under 44px, no link hidden in a scrolling bar.

**Copy.** For words people read; code and data names (`Club`, `clubId`, `/clubs`,
permission keys) stay as they are.
- One name per concept: **site** (never club or working area), **Pool deck**, **HR**,
  **waitlist**, **No limit** (never uncapped).
- Create buttons read "Add a <noun>" ("Add a swimmer", "Add a site"). Domain verbs stay as
  they are: Find a swimmer, Book an assessment, Log refund request, Report absence.
- "and", not "&". Commas or colons, not em dashes.
- Dates, times and counts come only from `src/lib/format.ts`, in one locale (en-GB, with
  "Sep" not "Sept"); never write `Intl.DateTimeFormat` or `toLocaleDateString` in a
  screen. `formatDay` "Sunday 4 October" (the year only when it is not this year),
  `formatShortDay` "Sun 4 Oct", `formatDate` "4 Oct 2026", `formatDateTime`,
  `formatDateRange` "28 Sep to 4 Oct", `formatTime` "16:30", `formatTimeRange`
  "16:30 to 17:15". Ranges use "to", never a dash. Counts go through
  `plural(n, one, many?)`: "1 swimmer", "3 classes".
- Errors: "Could not <do the thing>. Try again." Rate limits and unavailable services:
  "… Try again later." or "Wait a few minutes and try again." Never "Please try again" or
  "Unable to".
- Empty states: "No <things> yet" or "No <things> match", with no full stop in the title.
  Subtitles and module descriptions (`src/modules/registry.ts`, shown on each overview)
  end without a full stop.
- No ellipsis in placeholders. Examples are neutral (Riverside, Sam Murphy); no customer or
  site names, and no site counts, in code.

**Cascade.** `docs.css` uses these tokens only. Its original layouts sit in
`@layer components.legacy`, below the Docs redesign in `@layer components`. `poolside.css`
and module CSS stay unlayered on top. A rule that must beat a utility class on a shadcn
primitive belongs in `poolside.css`.

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
live on the session's setup page. Awaiting enrolment has its own sidebar entry. The searchable, paginated list combines pending placements
and class waitlists, grouping by swimmer and programme with each requested class
visible. It offers family contacts, matching classes for placements and confirmed
waitlist promotion when a space is available. Both lists re-home secondary
columns on phones and retain 44px actions.
Awaiting enrolment has linked Enrolments & waitlists and Awaiting moves views.
The moves view shows the current class/site, next curriculum level where one
exists, instructor confirmation, note and family contacts. It reuses the guarded
cross-site move dialog. Changed progress is labelled Needs review and withholds
the queue's move action. Instructor offers Ready to move inside each swimmer's
expanded competency list, only when every competency at that level is achieved
and saved for that swimmer. Unsaved marks show a save reminder instead. Awaiting
move status and Undo readiness stay within that swimmer's list, with
confirmations and inline save errors.
See [assessment workspace](docs/assessments.md) for queue rules and verification.

Both awaiting views show each swimmer's latest contact outcome, recorder and
next follow-up date, including overdue wording. Follow-up history opens a
shadcn Sheet, full width on phones and capped at 42rem on larger screens. It
contains an append-only activity timeline and a permission-gated Add update
form. Errors preserve entered notes, reload allows a stale save to be reviewed,
and successful saves refresh the row. The same history remains available from
the swimmer profile. Notes are staff-only, shared across sites and unrelated to
queue membership; history is paginated 20 entries at a time.

Together, Activity, Programmes and levels, Staff, Roles,
Sites, Account, sign-in and loading states also use this shared foundation.
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
the same theme and the v2 top bar (fin, appearance, the way back). The module rail, the
bottom bar's More and the deck bar open Help in a new tab; the account menu has no Help. Instructor opens `/help/instructor`, with teaching-only guides and a
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

**Reads respect permissions.** Each page requires the permission that opens it;
setup pages and the activity log also require their named permissions. Mutations enforce
their own permissions regardless of which controls are visible. Instructor
records additionally require a confirmed start for that dated class.

**Administrators always have full access** (owner confirmed 13 September 2026).
Holding both `staff.manage` and `roles.manage` defines administrator access;
neither permission alone does. `expandPermissions` and `visibleScreens` resolve
the full current catalogues, so existing administrators receive newly added
capabilities without a data update. Names and the legacy `User.role` enum never
decide this. Role previews use the previewed grants, and demotion or deactivation
takes effect on the next request. The role editor shows inherited access and
keeps the two management grants editable. Their removal returns to the role's
stored selections. Instructor's separate navigation and dated start checks
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

**Screens are menu entries, opened by a permission.** Each top-level page in
`src/lib/staff/screens.ts` names the one permission that opens it, and a role's
levels give permissions (docs/how-turnfin-works.md). Nothing stores screens.
Every page under the shell opens with `screenPage(screen, permission?)` and
404s for anyone without that permission; a link into another screen asks
`canSee` first. That is how a swim teacher (Pool deck: Teach) sees the
instructor view and nothing else. Account is never on the list because it is
always there. The keyholder guard keeps at least one active account holding
`staff.manage` and one holding `roles.manage`.

**The home page is the only front door.** `/` is the role's home page; old
`/start`, `/reception`, `/reception-portal` and `/modules` links redirect to it.
**Two kinds of navigation, never mixed.** The module rail (bottom bar on phones and touch)
lists Home and the person's modules (`useYourModules`); the page bar lists only the open
module's pages. Both hold navigation only: no action buttons such as "New document"; a
module's main action sits in its page heading. The pool deck keeps its own frame.

Analytics lives in Monitoring as a separate shadcn dashboard. Its bento grid
uses three headline totals, a larger programme/level breakdown, and supporting
monthly cancellation and daily activity cards. Exact labels accompany the
level bars showing enrolled places divided by that level's total class capacity;
a table gives the current Monday–Sunday week without relying on colour, with
future days marked as upcoming rather than zero activity. A shared page navigation
links Overview, Reception activity and Instructor attendance. The two reports
use compact bordered tables with staff search, plain numeric totals and 44px
controls. Reception offers daily breakdowns per person. Instructor rows filter
the dated class detail table; status buttons isolate outstanding, saved or upcoming
classes. Attendance badges use the report metadata map. Saved-by detail moves
into the attendance cell on phones.
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
  `src/modules/activities/lib/attendance/access.ts`.
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
typed (`src/modules/activities/lib/students/actions/search.ts`), debounced, and never receives the
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
item in `src/modules/activities/lib/nav.ts` in the same change as the page.

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
cookie-backed working site filters the timetable; it does not restrict swimmer
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
graduation, the current rung — is derived in `src/modules/activities/lib/progression/rules.ts` and
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
`src/modules/activities/lib/enrolment/seat.ts` takes `SELECT … FOR UPDATE` on the
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

### Legend agreement confirmation belongs to the class place

New enrolments have an unselected, explicit Legend agreement question. Pending
agreements do not block enrolment. Existing active places read **Needs checking**;
never imply that missing information means done. The site-scoped Legend agreements
page shows one row per place, with a named confirmation and timestamp. Moves carry
the prior state and attribution. The page follows Swimmers and Classes: full-width
search, a Neutral segmented status filter, bordered directory with a muted header,
compact aligned rows and blue confirmation buttons with check icons. On phones,
the class details and agreement action stack within the swimmer's row. Confirming
uses `enrolment.manage` and the course lock, and writes the audit row atomically.
See [the workflow](docs/legend-agreements.md).

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

### Teaching is confirmed, shared and recorded

Every instructor confirms Start class before opening a class on the deck,
including their own scheduled classes. Confirmation creates a ClassCover row
for that class and date and an audit entry in the same course-locked
transaction. The unique course/date key preserves the original start. Repeated
and simultaneous confirmations do not overwrite it or duplicate its audit.
All authorised instructors can open a started class, including an existing
session whose original instructor's account has been deleted.

The deck shows Start class or Open class. Attendance saved/to-take remains a
plain operational indicator; shared sessions identify who started them. Each
save records its actual actor. Attendance, competencies and completion recheck
the dated start and permissions under the course lock; the class page checks
the start before loading swimmers. Register revision checks still prevent stale
overwrites. Desk transcription retains attendance.markAny without granting
Instructor screen access.

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

Turnfin is split into Core, Work modules and Activities; see
[docs/architecture.md](docs/architecture.md) for the rules and the lint that
enforces them.

```
src/app/(core)/                Core: Staff, Roles, Sites (/clubs), Activity, Account
src/app/(activities)/          the Swim school desk shell and its pages
src/app/(instructor)/          the Swim school pool-deck workspace
src/app/sign-in/               the front door, outside the shell
src/modules/activities/lib/    Activities domains (students, courses, enrolment, ...)
src/modules/activities/components/ Activities feature components
src/modules/registry.ts        every module's description and levels
src/modules/contributions.ts   what modules add to Core pages, without imports
src/components/ui-kit/         shared shadcn compositions — tag, page-header,
                               empty-state, segmented-links
src/components/ui/             shadcn compositions for native form submission
src/components/                Core and Work feature components
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
`src/app/(instructor)/instructor/`, outside the desk layout. Its shadcn
frame contains classes, site switching, appearance and sign-out. The entire
Instructor surface now uses shadcn Button, Item, Dialog, RadioGroup, Select,
Collapsible, Alert, Label and Textarea. The shared teaching forms retain drafts,
retry handling, audit and concurrent-save comparisons. Scoped CSS makes every
pool-deck control at least 44px, including browsers reporting a mouse. The
independent Neutral ui-* tokens follow the shared theme provider.

The competency step defaults to expandable swimmer rows. A 44px By swimmer /
By competency control switches the layout while retaining marks, the expanded
swimmer and the selected competency. By competency uses previous/next controls
and swimmer mark rows. Both layouts share the attendance
filter, draft recovery and one Save marks bar. Selected view uses the blue
selection tokens; the desk's competency layout remains unchanged.

Class overview sits alongside the attendance and competency steps. The owner
specified a simple bento grid of totals: one shadcn Card for each competency,
showing its full name and “Y out of Z achieved”. Use two columns from 360px and
three from 1024px, with one column on narrower screens. Neutral bordered cards
have no shadow, icon, disclosure or swimmer list; numbers use tabular figures.
Cards grow to fit long names and require no horizontal scrolling. A brief note
explains that the totals use saved marks and include absent swimmers.

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
