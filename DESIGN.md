# Turnfin 2.0: the design

**Status: approved.** The owner approved **Turnfin Sheet** on 1 November 2026 ([decision D20](docs/decisions.md)), replacing Turnfin Glass (D13). It is the one design for every screen in Turnfin, Turnfin Me and the Academy booking site. This file is its contract. Building it is roadmap step 5 ([docs/roadmap.md](docs/roadmap.md)); until each part is built, the live app keeps Turnfin Glass, which is built and live (see "Until it is built").

- **The approved screens:** row D of the design canvas: Home, Refunds with an open refund, the pool deck register, and Home on phone in light and dark (https://claude.ai/artifact/QmVi8aMcECQzQxNNrgEKe5). Row G holds the fin texture options; "Fin XL, white" was chosen.
- When this file and the canvas disagree, this file wins. The tokens live in one theme file, [`src/app/theme/glass.css`](src/app/theme/glass.css), which holds the Glass values until step 5 swaps in these; from then the theme file holds the values and the tables below say what each one is for.

## The idea

Turnfin sits on its own colour. The logo's blue is the ground, the work sits on one white page that floats on it, and the logo's fin, drawn oversized, gives the blue its texture. It should feel premium, calm enough for a whole shift, and unmistakably Turnfin.

1. **Two layers.** The blue `ground` holds the frame: the sidebar, the greeting on phones and the tab bar. The white `sheet` holds the work. Content never sits on the ground, and the frame never sits on the sheet.
2. **One colour, the logo's.** The ground and every primary action are `brand`. Nothing else is decorative colour.
3. **Colour means something on the sheet.** Orange means needs action now, green means done, red means serious, the cyan dot means live. Everything else is neutral, with a word beside every colour.
4. **The job first.** Each page leads with what needs the person, and lets them act on it in place.
5. **Show the change where it happens.** A row ticks, a count changes, a tag turns green, and a confirmation offers Undo.
6. **Accessible always.** WCAG 2.2 AA in light and dark, 44px targets, a whole row or tile as the target on the pool deck.

## Tokens

The values below are the contract. Names are the CSS custom properties the theme will define (`--ground`, `--brand` and so on).

### Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `ground` | #0062b1 | #0062b1 | The logo's deep blue, behind the frame, at every width and in both themes. |
| `on-ground` | #ffffff | #ffffff | Text, titles and symbols on the ground (6.2:1; 5.1:1 over the fin). |
| `on-ground-2` | #ebf3fa | #ebf3fa | Secondary text on the ground: the date, "Apps", counts, the person's job (5.5:1; 4.5:1 over the fin). Never translucent white, which fails over the fin. |
| `ground-fill` | rgba(255,255,255,.14) | rgba(255,255,255,.14) | The search field and hover on the ground. |
| `sheet` | #ffffff | #0d151e | The page the work sits on. |
| `surface` | #f4f7fa | #16202b | Figure tiles, the refund amount, empty register tiles. |
| `label` | #101b27 | #eef3f8 | Primary text on the sheet. |
| `label-2` | #52657a | #93a4b6 | Secondary text and a row's second line (6.0:1; 7.2:1). |
| `label-3` | #9aa9b8 | #5d6e80 | Chevrons and decorative marks. Never text. |
| `sep` | #e8eef4 | #1f2a36 | Hairlines between panes and rows. |
| `brand` | #0062b1 | #0062b1 | The one prominent action per view, and selected counts. White text on it. |
| `brand-ink` | #0062b1 | #7cc0ff | Links, text buttons, the date line, symbols on the sheet. |
| `brand-soft` | #e8f1fa | #16273a | Icon tiles, avatars, the selected row, a marked register tile. `brand-ink` on it (5.4:1; 7.8:1). |
| `neutral-soft` / `neutral-ink` | #eef3f8 / #3b5068 | #1a2532 / #c3cfdb | Tags that only say when: "Due 14:00", "Today" (7.4:1). |
| `urgent-soft` / `urgent-ink` | #fff0e6 / #a8380a | #3a1d0e / #ffab78 | Needs action now: tags, the "Needs you" badge, a medical note (5.8:1; 8.3:1). |
| `done-soft` / `done-ink` | #e6f4ea / #1d6b3a | #12301d / #6fd08f | Done, approved, covered (5.8:1). |
| `serious-soft` / `serious-ink` | #fde8e7 / #b42318 | #3a1514 / #ff8a80 | Serious incidents, failures (5.6:1). |
| `live` | #08819a | #3fd0e6 | The live dot beside a reading ("Live · in range"). A mark with a word, never alone (4.6:1). |
| `scrim` | rgba(0,20,40,.32) | rgba(0,0,0,.5) | Behind a dialog. |

### The fin

The ground carries one texture: the logo's fin, drawn as a white silhouette of the real logo (`public/brand/turnfin-fin-mask.png`, made from `turnfin.png` at 2560px so its edge stays sharp on high-density screens).
- **Fin XL, white:** white at **10%**, masked by the logo's shape, oversized on purpose, with its tip pointing up into the blue.
- **Desk and tablet:** about 1100px, anchored to the foot of the window: its tip about 400px above the bottom near the sidebar's right edge, its body running off the bottom and on under the sheet, as if too big to fit.
- **Phone:** about 700px, its tip near the top right, sweeping behind the greeting.
- One fin per screen, only on the ground, never on the sheet, never moving, and never coloured. Under *Increase contrast* it goes.

### Shadows

| Token | Light | Dark |
| --- | --- | --- |
| `shadow-sheet` | 0 1px 2px rgba(0,30,60,.18), 0 18px 50px rgba(0,30,60,.28) | 0 18px 50px rgba(0,0,0,.45) |
| `shadow-selected` | 0 2px 10px rgba(0,0,0,.15) | same |
| `shadow-prominent` | 0 6px 16px rgba(0,98,177,.3) | same |
| `shadow-float` | 0 2px 6px rgba(0,30,60,.1), 0 12px 32px rgba(0,30,60,.18) | 0 12px 32px rgba(0,0,0,.5) |

### Type

One family, **Manrope** (400 to 800), then `system-ui`. Numbers that line up or change are tabular. Titles are tight and heavy; body text is medium.

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `greeting` | 42 / 44, −0.035em | 800 | Home's "Good morning, Niamh" on desktop; 32 on phones. |
| `title` | 34 / 38, −0.03em | 800 | A page's H1 on desktop and tablet; 30 in a list pane. |
| `title-2` | 24 / 30, −0.025em | 800 | The app's name in the sidebar; a record's name in a detail pane. |
| `section` | 18 / 24, −0.01em | 800 | Section headings ("Needs you"). |
| `row` | 16 / 22, −0.01em | 700 | A row's first line. 17 on the pool deck. |
| `body` | 15 / 22 | 500 | Text and details. |
| `meta` | 13.5 / 18 | 500 | A row's second line, subtitles, hints. |
| `nav` | 14.5 / 20 | 600 | Sidebar items; 800 when selected. |
| `tag` | 12.5 / 16 | 800 | Tags and counts. |
| `figure` | 34 / 38, −0.03em | 800 | Figure tiles; 44 for an amount being decided. |
| `eyebrow` | 14 / 18 | 700 | The date and site line above a title, in `brand-ink`. |

### Space, size and radius

- **Spacing:** 2, 4, 8, 10, 12, 16, 22, 26, 40, 48 (px). The sheet's padding is 40/48 on desktop, 28/30 on tablet, 22/16 on phones.
- **Sizes:** `control-height` 44 (every target, at every width); rows 64 on desktop lists; register tiles at least 92 on the tablet; `sidebar-width` 248 (220 on tablet); the sheet is inset 10px from the window's top, right and bottom.
- **Running type and layout limits** keep the names D15 gave them: the kit reads the type scale through `type-caption`, `type-body`, `type-title`, `type-large-title` and `type-figure`, each with its `-leading` (so Turnfin Me's text size can step them up); overlays keep a 16px gutter (`overlay-max-width`, `overlay-max-height`); grids and fields take `tile-min` 10rem, `card-min` 14rem, `column-min` 22rem, `rail-width` 20rem, `field-min` 18rem and `deck-width` 1180px.
- **Radii:** `radius-item` 11 (sidebar items, search), `radius-control` 12 (buttons; 15 on the pool deck), `radius-tile` 13 (icon tiles), `radius-row` 16 (rows and register tiles), `radius-card` 18 (figure tiles, the amount panel), `radius-sheet` 22 (the desktop sheet; 28 on the phone sheet's top corners), `radius-pill` 999 (tags, counts, the tab bar).

### Motion

Calm and quick. Hover and press take 150ms (`ease-out`); a row eases 2px to the right on hover. Sheets, menus and the drill-in of the sidebar move on a gentle spring (about 4% overshoot, 450ms). A changed count rolls, a tick draws itself, a tag fades to its new colour. Nothing moves on its own except the live dot. Under *Reduce motion* every transition completes at once, and the state still changes.

## The frame and navigation

Turnfin is one frame holding apps ([PRODUCT.md](PRODUCT.md)). What it shows is worked out from the person's levels and the width, never from a layout kept for each role ([D19](docs/decisions.md), [architecture.md](docs/architecture.md#the-frame)). These rules hold whatever the look:
- **One level of navigation on screen.** The sidebar (or, on phones, the tab bar) is the only navigation. There are no top tabs and no page bars.
- **Home is the work.** One "Needs you" list across apps, each item naming its app, then today. There is no separate "Today" entry.
- **Only your apps, in a fixed order.** Never ranked by use, so shared desks and training screenshots stay right.
- **Five pages and Set up.** An app shows at most five work pages, then Set up after a separator. Each page has a place in its app's page list: a work page (the sidebar), `setup` (under Set up, which opens in place and shows only when the person may open one of its pages) or `overview` (reached from the app's Overview, which lists every page). The first work page is the Overview. `src/modules/module-pages.test.ts` checks every app.
- **One app, no list.** A person with exactly one app lands straight in it, and its pages are the navigation.

### Desktop (1100px and wider)

- **Sidebar,** on the ground, `sidebar-width` wide, with the fin behind it. It drills in:
  - On Home: the logo in a white app-icon tile (34px, `radius-item`) with "Turnfin" beside it (to Home), the search field ("Search · Ctrl K"), Home, "Apps", and the person's apps in group order.
  - In an app, the list slides across to "‹ Home", the app's name in `title-2`, and its pages. Set up sits last, after a hairline.
  - The open item is a white pill with `brand-ink` text and `shadow-selected`. Its count sits in a `brand` pill. Other counts are plain `on-ground-2` numbers. No red badges.
  - The person's initials in a white circle, their name and "job · site ▾" sit at the foot and open the account menu.
- **Sheet,** the page: `sheet`, `radius-sheet`, `shadow-sheet`, inset 10px from the window.
  - The header: the `eyebrow` line (date and site menu, "Saturday 1 November · Riverside ▾"), the H1, and a `meta` line that says what matters ("6 things need you today, 2 of them urgent"). The one prominent action sits at the trailing end of the header.
  - Then the page's content.
- **Detail** opens beside the list in the same sheet: a list pane (400px) and a detail pane, split by a hairline. Quick actions sit at the foot of the detail pane.
- **Confirmations** happen in place (the tag turns, a line says what happens next, with Undo), and a notification at the top right when the result is elsewhere.
- **Search** opens from the sidebar's field (under the logo), Ctrl K or ⌘K, and the phone's white circle beside the tab bar, as a white panel over a `scrim`. It finds the person's apps and the open app's pages, people (for those who manage staff) and swimmers (for the swim school's desk): each hit is a name and one short line.

### Tablet and the pool deck (768px to 1099px)

- The same ground, fin and sidebar (220px), drilling in, with labels always shown. An instructor who holds only the pool deck sees its pages and nothing else.
- Targets grow: sidebar items 52px, rows and tiles at least 64px (register tiles 92px), buttons 56px. No hover-only, swipe-only or small controls.
- Detail opens in a sheet that rises to two thirds of the height.

### Phone (under 768px), including Turnfin Me

- **The ground holds the top:** the logo tile and the person's avatar, then the `eyebrow` line, the greeting or title, and a `meta` line, all on the blue with the fin behind.
- **The sheet rises** from below the header with `radius-sheet` 28 top corners, and scrolls under the tab bar. On scroll the header collapses to a slim bar on the ground with the title centred.
- **Tab bar.** A white capsule (`shadow-float`) 18px from the sides and 28px above the bottom, clear of the home indicator. It holds Home, the open app and Apps (for a person with one app, its pages), and search as a separate white circle. The selected tab is a `brand` pill with white text. In dark, the capsule is #1a2532 with a #273546 edge.
- **Choices and small forms** open in a bottom sheet on `sheet`, with a grab handle. Long forms are full-height.
- **Safe areas.** Content clears `env(safe-area-inset-*)`.

## The page shell

- Every page is one `PageShell` with one `PageHeader` holding its one H1, as now (AGENTS.md, "Screens"). Step 5 rebuilds both in this design: the header gains the eyebrow line, the meta line and the trailing action; on phones it moves onto the ground.
- A page leads with what needs the person: a "Needs you" list, or the "Not covered yet" lane. Then what is happening now (figures, the day). Then the rest.
- Lists are rows on the sheet itself, not boxed cards: each row is an icon tile (or avatar), two lines of text, a tag, and a chevron, with `radius-row` hover. Figures sit in `surface` tiles. Never boxes inside boxes.
- A page that shows the day uses `DayTimeline`: blocks on the sheet, with the now line in `serious-ink`. Blocks that overlap in time take rows of their own within their lane, as Calendar stacks them; a hairline parts one lane from the next.

## Components

The 2.0 kit. Each restyles or replaces a piece of today's Glass kit (`src/components/shadcn`, `src/components/ui-kit`, `ui-kit/glass.tsx`). Radix behaviour stays where shadcn has it; the look changes. This contract approves the new components marked **new**.

| Component | Replaces or restyles | Notes |
| --- | --- | --- |
| `Ground` | `GlassRoot`, `Glass` | The blue frame with the fin. Kit only: pages never draw the ground or the fin themselves. The glass material and lens filters go. |
| `PageSheet` | the page frame in `ModuleShell` | The white page on the ground. |
| `Sidebar` | the module rail in `ModuleShell` | Drills in; white selected pill. |
| `TabBar` | the phone bottom bar in `ModuleShell` | White capsule plus search circle. |
| `Button` (prominent, soft, plain) | `shadcn/button` | One prominent `brand` action per view. Soft is `neutral-soft` with `brand-ink` text; plain is `brand-ink` text. |
| `List`, `ListRow` | `shadcn/item`, `ui-kit` rows | Icon tile or avatar, two lines, tag, chevron. |
| `IconTile` | **new** | 42px `brand-soft` tile with a Lucide symbol in `brand-ink`. |
| `Tag` | `ui-kit/tag` | Same `StatusMeta` map; tones become neutral, urgent, done and serious. |
| `Figure` | the `.pc-stats` tiles | Label, big number, one context line. |
| `DetailPane` | `Inspector`, `ui-kit/record.tsx` | The record beside its list on desktop. |
| `RegisterTile`, `ProgressRing` | `shadcn/progress` for sets of things | Pool deck registers and checks. |
| `Avatar` | `shadcn/avatar` | Initials only, `brand-soft` or white on the ground. |
| `Search` | `shadcn/command` and the search tool | Pages, people, members. |
| `Sheet` | `shadcn/sheet` | The phone bottom sheet and the tablet detail sheet. |
| Dialog, alert dialog, inputs, select, checkbox, radio, switch, table, empty, skeleton, tooltip | the shadcn originals | Restyled to these tokens: `sheet` dialogs with `radius-card` corners, `surface` inputs at 44px, `radius-pill` chips, a `done-ink` switch when on. |

Icons stay **Lucide** (lucide-react) at 1.9 stroke: 20px in rows and tiles, 15 to 16px in the sidebar and search. No emoji.

## States

- **Loading.** The ground, sidebar, title and section headings show at once. Content areas show `surface` placeholder shapes the size of what is coming, with a gentle fade. No full-page spinners. A button that saves keeps its width and shows its pending label.
- **Empty.** An icon tile, one sentence saying what will appear here, and the action that adds the first item. An empty list of problems is good news: "Everything is covered", in `done-ink`.
- **Error.** Say what failed and what to do, where it failed, with Try again; keep everything the person typed. A failed save keeps the change on screen, marked, until it is saved or undone.
- **Saved.** The change shows where it happened first (the tag turns, the count changes, a tick), with a past-tense sentence and Undo ("Approved. Finance will pay it on Monday."). Undo stays for a few minutes.

## Forms and confirmation

- Forms are rows on the sheet. Labels sit above fields in `meta` `label-2`. Fields are 44px or more on `surface`, with 16px text on touch. Choices of two to five are chips; longer lists open a menu. Switches apply at once. Time defaults to now.
- On phones a form is a full-height sheet with Cancel leading, the title centred and a `brand` Done trailing, which stays disabled until the form can be sent. On desktop the same form is a page, or a detail pane with Save at the foot.
- **Prefer undo to "Are you sure?".** Confirm only what cannot be undone (delete for good, send to a family, close a serious report). Use an alert dialog that names the thing and the consequence, with the destructive button in `serious-ink`, worded as the action ("Delete report"), never "Yes".
- A choice that alerts other people says so before sending, in a `serious-soft` note: "Serious report. Sending it alerts the duty manager and the centre manager straight away".

## The pool deck

The pool deck is used poolside on tablets, in wet hands, in bright light.
- Tablet frame (above). The register is a two-column grid of tiles at least 92px tall, and the whole tile is the target.
- The register pattern:
  - the class time as the eyebrow, "Stage 3 register" as the title, and a `ProgressRing` with "5 of 8 here"
  - one tap marks a swimmer here (`brand` circle with a tick on a `brand-soft` tile), a second tap unmarks; an unmarked swimmer shows their initials in a dashed circle on `surface`, with a word as well as a mark
  - "Everyone's here" (soft) and "Finish register" (prominent) at the foot.
- Nothing depends on hover or fine pointing. Text is at least 16.5px.
- Medical notes stay off the register list beyond a one-line flag that a note exists; the note itself opens on the swimmer's record for those whose job needs it ([docs/apps.md](docs/apps.md)).

## Turnfin Me

Turnfin Me is the person's own app on their own phone, so it uses the phone frame only: the greeting on the ground with the fin, the rising sheet, the white tab bar, bottom sheets for choices and forms, and the same tokens with its own copy of the kit (AGENTS.md, "Screens").

## Accessibility

- **WCAG 2.2 AA in both themes.** Text 4.5:1, or 3:1 at 24px+ or bold 19px+. Marks and focus 3:1. The ratios are beside each colour token above. On the ground, text is only `on-ground` or `on-ground-2`, which pass over the fin too.
- **Not by colour alone:** every status has a word or symbol.
- **Targets:** 44px at every width; whole tiles on the pool deck.
- **Focus:** a 2px ring with a 2px offset, `brand` on the sheet and white on the ground. Overlays trap focus, close with Esc and return focus to the control that opened them. Search and lists work with the arrow keys and Enter.
- **Roles:** the current page or tab has `aria-current`; register tiles are `aria-pressed` buttons; switches are `role="switch"`; notifications are `role="status"` and read the whole sentence; icon-only buttons are named; the fin and icon tiles are `aria-hidden`.
- **System settings:** *Reduce motion* ends animations at once. *Increase contrast* removes the fin and adds a 1px edge to the sheet. *Forced colours* use system colours.

## Until it is built

- The live app runs on **Turnfin Glass**, built 25 to 27 October 2026: the tokens in `src/app/theme/glass.css` (with copies in `apps/me` and `apps/academy`), the material and frame in `src/app/theme/kit.css` and `src/components/ui-kit/glass.tsx`, and every screen inside the frame. Its contract is the previous version of this file in git history, and D13.
- Until step 5 replaces a part, that part stays Glass. No two designs in one screen: do not add Sheet piecemeal to Glass screens, or Glass ideas to Sheet ones.
- The screen rules in [AGENTS.md](AGENTS.md) ("Screens") hold throughout.

## How it is built

Roadmap step 5, in this order. It re-themes the built Glass work rather than starting again; each part removes the Glass look it replaces.

1. **The theme** (started 1 November 2026: these tokens, Manrope, the ground with the fin, the sheet, the sidebar and rail on the ground, and the white tab bar; the glass material is flattened to opaque fills until the kit step removes it). These tokens replace the Glass values in the theme file, in light and dark, mapped into `src/app/shadcn.css`; the `type-*` and layout tokens keep their names. Manrope is loaded with `next/font`. The fin's mask uses the logo from `public/brand/turnfin.png`. The glass material, lens filters and unused springs go. The file takes a plain name once nothing names `glass.css`.
2. **The kit.** The components above, restyled in `src/components/ui-kit` on the shadcn primitives: `GlassRoot` and `Glass` become `Ground`, `Inspector` becomes `DetailPane`. The lint rules (AGENTS.md, "Enforcement") follow.
3. **The frame** (built 2 November 2026, 3.0.0: the drill-in sidebar and the phone tab bar with search, no top tabs, Set up and the five-page check, one-app landing, the pool deck in the shared frame, Home's one list of work, and the phone header on the ground). `ModuleShell` becomes `Ground`, `Sidebar`, `PageSheet` and `TabBar`, with the drill-in frame of D19: the app's pages move from the toolbar's segmented control into the sidebar. `PageShell` and `PageHeader` are rebuilt in this design.
4. **Home and the app frame,** then each app, one pull request each, checked in the running app at phone, tablet and desktop widths in light and dark.
5. **Turnfin Me and the Academy booking site,** with their own copies of the theme and kit.

## Screen checklist

- [ ] One job, for one kind of person; what needs them comes first, with its action in place.
- [ ] The frame on the ground with the fin; the work on the sheet; nothing of either on the other.
- [ ] One prominent `brand` action at most; other buttons soft or plain.
- [ ] Colour only for needs action, done, serious and live, always with a word or symbol.
- [ ] Type from the scale in Manrope; numbers tabular; staff words, sentence case, no codes.
- [ ] 44px targets (whole tiles on the pool deck); focus visible; overlays trap and return focus.
- [ ] Every change shows where it happens, with Undo where it can be undone.
- [ ] Loading, empty, error and saved states designed.
- [ ] *Reduce motion*, *Increase contrast* and forced colours checked.
- [ ] Seen in the running app at phone, tablet and desktop widths, in light and dark, with synthetic data only.
