# Turnfin 2.0: the design

**Status: approved.** The owner approved **Turnfin Glass** on 25 October 2026 ([decision D13](docs/decisions.md)). It is the one design for every screen in Turnfin, Turnfin Me and the Academy booking site. This file is its contract. Building it is roadmap step 5 ([docs/roadmap.md](docs/roadmap.md)); until each part is built, the live app keeps the pre-2.0 theme (see "Until it is built").

- **The approved screens:** the Turnfin Glass canvas, a clickable prototype of Home, Rota, Incidents and Swim school on desktop and phone (https://claude.ai/artifact/WZWn3yZv7Q7J6bg2wiaYDd).
- **The design system:** every token, component (with live previews), pattern and accessibility pair, for people and coding agents to browse (https://claude.ai/artifact/6Ex4VcQGtPRBheTqVtgWWM).
- When this file and either of those disagree, this file wins. The tokens are now in the theme file, [`src/app/theme/glass.css`](src/app/theme/glass.css), which holds the values; the tables below say what each one is for.

## The idea

Turnfin Glass is Apple's Liquid Glass (iOS 26 and 27, macOS 26), done to Apple's Human Interface Guidelines and brought to a web app for leisure-centre staff. It should feel like Apple made it: calm, premium and alive.

1. **Three layers.** A plain ground (`bg`), opaque content on it (`bg-2`: lists, cards, timelines), and a functional layer of Liquid Glass floating above (sidebar, toolbars, tab bar, sheets, menus, inspectors, banners). Glass never goes on content, and never on glass.
2. **Colour means something.** Neutrals carry the interface. The fin blue (`accent`) means selected or the primary action. Orange means needs action, green means done or covered, red means now or serious. Nothing else is coloured.
3. **The job first.** Each page leads with what needs the person, and lets them act on it in place, without leaving the page.
4. **Show the change where it happens.** A resolved row ticks, a count rolls, the gap on the timeline turns green, a confirmation arrives with Undo.
5. **Alive, not busy.** Everything moves on springs and settles like an object. The day moves with the clock. Nothing moves without a reason, and *Reduce motion* turns it all off.
6. **Accessible always.** WCAG 2.2 AA in light and dark, 44px targets, a whole row as the target on the pool deck, and fallbacks for reduced transparency, increased contrast and forced colours.

## Tokens

The values below are the contract. Names are the CSS custom properties the theme will define (`--bg`, `--accent` and so on).

### Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | #f2f2f7 | #000000 | The page ground. No wallpaper, gradient or pattern. |
| `bg-2` | #ffffff | #1c1c1e | Content: grouped lists, cards, timelines, figure tiles. |
| `bg-3` | #f5f5f8 | #242427 | Hover on a row or card that opens something. |
| `fill` | rgba(120,120,128,.12) | rgba(120,120,128,.26) | Tinted buttons, switch track off, solid segmented controls. |
| `fill-2` | rgba(120,120,128,.07) | rgba(120,120,128,.16) | Icon tiles, pressed rows, done blocks, loading placeholders. |
| `label` | #000000 | #ffffff | Primary text, on any ground or glass. |
| `label-2` | rgba(60,60,67,.76) | rgba(235,235,245,.64) | Secondary text (5.3:1 on white). Apple's 60% misses AA. |
| `label-3` | rgba(60,60,67,.4) | rgba(235,235,245,.36) | Chevrons, disabled, decorative marks. Never text. |
| `sep` | rgba(60,60,67,.14) | rgba(84,84,88,.55) | Row hairlines (inset to the text), timeline grid. |
| `accent` | #1d5fd1 | #6aa4ff | The fin blue: selection, links, text buttons, sidebar symbols. Dark is #6aa4ff, not #4f8fff, so a blue label on a grey button keeps 4.5:1 on a card. |
| `accent-btn` | #1d5fd1 | #2a68e0 | The one prominent action and filled buttons; white text on it. |
| `accent-hi` | #2a6be2 | #3a76ee | Hover of `accent-btn`. |
| `accent-soft` | rgba(29,95,209,.11) | rgba(79,143,255,.18) | Selected list item, best suggestion, avatars, on-now blocks. |
| `accent-ink` | #1747a3 | #a8c7ff | Text on `accent-soft`. |
| `green` | #34c759 | #30d158 | Done as a large fill: switch on, rings, covered bar. Not text. |
| `green-ink` | #1b7537 | #5ce383 | Text that says done or covered. |
| `green-mark` | #1d7a3a | #30d158 | Small done marks (ticks) and the Saved button. |
| `on-green` | #ffffff | #000000 | Tick or text on `green-mark`. |
| `green-soft` | rgba(52,199,89,.15) | rgba(48,209,88,.17) | Ground of done tags, covered blocks, resolved tiles. |
| `orange` | #ff9500 | #ff9f0a | Needs action, as a bar or mark. Not text. |
| `orange-ink` | #a84c00 | #ffb340 | Text that says something needs action. |
| `orange-soft` | rgba(255,149,0,.14) | rgba(255,159,10,.16) | Ground of needs-action tags, gaps, tiles. |
| `red` | #ff3b30 | #ff453a | Now: the live dot and the now line. Not behind text. |
| `red-ink` | #c22219 | #ff6b62 | Text for serious. |
| `red-badge` | #d70015 | #d70015 | App badges and the now pill, behind white text. |
| `red-soft` | rgba(255,59,48,.11) | rgba(255,69,58,.16) | Ground of serious tags and warnings. |
| `scrim` | rgba(0,0,0,.18) | rgba(0,0,0,.42) | Behind a dialog. Sheets push the stage back instead. |
| `stage` | #000000 | #000000 | Around the screen when a sheet pushes it back. |

### The material

| Token | Light | Dark |
| --- | --- | --- |
| `glass-fill` (body) | rgba(255,255,255,.5) | rgba(42,42,46,.52) |
| `glass-fill-hi` (pressed) | rgba(255,255,255,.72) | rgba(66,66,72,.7) |
| `glass-spec` (top inner edge) | rgba(255,255,255,.96) | rgba(255,255,255,.36) |
| `glass-spec-2` (bottom inner edge) | rgba(255,255,255,.5) | rgba(255,255,255,.1) |
| `glass-glow` (inner light) | rgba(255,255,255,.42) | rgba(255,255,255,.05) |
| `glass-shade` (inner lower shade) | rgba(0,0,0,.06) | rgba(0,0,0,.4) |
| `glass-edge` (hairline) | rgba(0,0,0,.06) | rgba(255,255,255,.09) |
| `glass-rim-a` / `glass-rim-b` (rim light) | #ffffff / rgba(255,255,255,.28) | rgba(255,255,255,.5) / rgba(255,255,255,.06) |
| `glass-hi` (pointer light) | rgba(255,255,255,.7) | rgba(255,255,255,.16) |
| `glass-sel` (selection droplet) | rgba(120,120,128,.16) | rgba(255,255,255,.13) |

Glass is `glass-fill` over a backdrop blurred by 10px (`glass-blur`), saturated to 190% (`glass-saturate`) and lifted to 1.04 (`glass-brightness`). It also has:
- inset light from `glass-spec`, `glass-spec-2`, `glass-glow` and `glass-shade`
- a 1px rim gradient from `glass-rim-a` to `glass-rim-b`
- `shadow-glass` beneath
- a 220px radial `glass-hi` light that follows the pointer on desktop
- lensing at its edges in Chromium: an SVG displacement map through `backdrop-filter: url()`, with three maps for bars, circles and panels.

In Safari and Firefox lensing is left out by an `@supports` guard, and everything else stays.

### Shadows

| Token | Light | Dark |
| --- | --- | --- |
| `shadow-glass` | 0 12px 32px -14px rgba(0,0,0,.28), 0 2px 8px -2px rgba(0,0,0,.07) | 0 16px 36px -12px rgba(0,0,0,.75) |
| `shadow-card` | 0 1px 2px rgba(0,0,0,.03) | none |
| `shadow-prominent` | 0 10px 22px -10px rgba(29,95,209,.75) | 0 10px 22px -10px rgba(79,143,255,.75) |

### Type

One family, the Apple system font: `-apple-system, BlinkMacSystemFont, "SF Pro Text"` (SF Pro Display for titles), then **Inter** with optical sizes on Windows and Android, then `system-ui`. Numbers that line up or change are tabular.

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `window-title` | 38 / 44, −0.022em | 700 | The H1 of a desktop page. |
| `large-title` | 34 / 41, −0.022em | 700 | The H1 on phone and tablet; collapses into the bar on scroll. |
| `title-1` | 28 / 34, −0.02em | 700 | A record's title in a detail pane or inspector. |
| `title-2` | 22 / 28, −0.018em | 700 | Sheet and dialog titles. |
| `title-3` | 20 / 25, −0.015em | 650 | Section headings. |
| `headline` | 17 / 22 | 600 | The row that needs you; bar titles. |
| `body` | 17 / 22 | 400 | Rows and text on phone and tablet. |
| `body-desk` | 15 / 20 | 400 | Rows and text on desktop. |
| `subheadline` | 15 / 20 | 500 | Subtitles; sidebar items at 14. |
| `footnote` | 13 / 18 | 400 | A row's second line, hints, notifications. |
| `caption` | 12 / 16 | 600 | Tags, menu section labels (tab bar labels at 10). |
| `caption-2` | 11 / 13 | 550 | Timeline hours, the now pill. |
| `figure` | 34 / 40, −0.03em | 700 | Figure tiles. |

### Space, size and radius

- **Spacing:** `space-hair` 2, `space-1` 4, `space-2` 8, `space-3` 10, `space-4` 14, `space-5` 18, `space-6` 22, `space-7` 26, `space-8` 28 (px).
- **Sizes:** `control-height` 44 (every target, at every width), `row-height` 58 (64 on the pool deck and in registers), `tabbar-height` 62, `sidebar-width` 250.
- **Radii:** `radius-xs` 6 (now pill), `radius-sm` 9 (icon tiles, timeline blocks), `radius-md` 10 (sidebar items), `radius-lg` 14 (menu items, results), `radius-panel` 22 (sidebar, figure tiles; inspectors 24), `radius-card` 26 (content cards, glass menus and popovers), `radius-sheet` 50 (phone sheets, concentric with the 58px screen corner at an 8px inset), `radius-capsule` 999 (every glass bar, button, tag, segmented control and tab bar).

### Motion

Everything that moves rides a spring, written as CSS `linear()` curves sampled from a damped spring:

| Curve | Damping | Overshoot | Use |
| --- | --- | --- | --- |
| `--spring` | 0.72 | about 4% | sheets, inspectors, morphs, rings, number rolls |
| `--bounce` | 0.5 | about 16% | droplets, presses, ticks, switches, the live banner |
| `--smooth` | 1 | none | anything that must not overshoot |

The exact `linear()` values (a damped spring sampled at 49 points, settling within the duration) are in [`src/app/theme/glass.css`](src/app/theme/glass.css).

Durations: `duration-press` 120ms, `duration-fade` 250ms, `duration-spring` 600ms, `duration-island` 700ms. `duration-banner` is 3200ms, how long a live banner stays expanded.

The micro-interactions every screen uses:
- **Press.** Glass controls grow to 1.08 and brighten to `glass-fill-hi`. Content buttons and rows dip to 0.94 or darken. Release springs back.
- **Select.** The `glass-sel` droplet slides to the chosen tab or segment on `--bounce` and squishes as it lands (`scale` 1.16 by 0.84, then settle).
- **Morph.** A menu or popover grows out of the button that opened it: width, height and radius on `--spring`, with the contents cross-fading through a 6px blur.
- **Present.** Sheets rise on `--spring`, and the screen behind scales to 0.93, rounds to 40px and dims to 82%. Inspectors slide in from the right.
- **Resolve.** A tick draws itself, a tile turns green, a count rolls in from above, a new block pops in, and a gap turns green.
- **Live.** The now dot breathes, the now line and pill move with the clock, and "starts in 20 min" counts down.
- **Scroll.** The large title collapses into the bar, the phone tab bar minimises beside its accessory, and a soft blur sits under every glass bar.

Under *Reduce motion* every transition completes at once, and the state still changes.

## The frame and navigation

Turnfin is one frame holding apps ([PRODUCT.md](PRODUCT.md)). The frame changes with the width.

### Desktop (1100px and wider)

- **Sidebar.** Floating glass (`panel`), inset 10px from the window, `sidebar-width` wide, with `radius-panel` corners.
  - At the top, the fin links to Home.
  - Then Home, an "Apps" heading, and the person's apps in the module bar's order. Symbols are `accent`, labels `subheadline` at 14px.
  - Each app may show a plain `label-2` count of what needs the person. No red badges in the sidebar.
  - The open app has a `glass-sel` fill, and a hover droplet glides between rows.
  - The person's initials, name and "role · site" sit at the foot and open the account menu.
- **Toolbar.** Sticky and transparent, with glass controls floating in it:
  - the app's pages as a glass `SegmentedControl`, leading
  - at most three glass groups of monochrome symbols, or a short label such as the site ("Riverside ⌄")
  - the one prominent action, trailing. It may be the **+** `MorphMenu` that grows into "New".

  A scroll-edge blur sits beneath the toolbar.
- **Page.** The content column starts at 290px, with 28px on the right.
  - The H1 (`window-title`) and a subtitle line that may hold an `accent` text menu ("Pool department ⌄"; "Riverside ⌄ · Friday 24 October").
  - Then the page's content.
- **Detail and quick actions** open in a glass `Inspector` from the right, or a morphing popover from the button.
- **Confirmations** arrive as a glass notification at the top right, with Undo.
- **Spotlight** opens from the toolbar's search button.

### Tablet and the pool deck (768px to 1099px)

- The sidebar becomes a glass rail of symbols, and its labels show on hover and focus. The app's pages sit in a glass segmented control at the top, centred.
- Rows are 64px, and the whole row is the target. Every control takes a wet hand: no small controls, no hover-only actions, no swipe-only actions.
- Detail opens in a sheet that rises to two thirds of the height.

### Phone (under 768px), including Turnfin Me

- **Large title** (`large-title`) at the top of each page. On scroll it collapses into a glass navigation bar with the inline title centred. The bar has glass circles: back on the leading side; the site, account or a page's actions on the trailing side.
- **Tab bar.** A glass capsule floats 20px from the sides and 24px above the bottom, clear of the home indicator. It holds up to four destinations (for Turnfin: Home, the open app or Today, Apps), plus search as a separate glass circle.
  - The selected tab shows a filled symbol in `accent` on a droplet.
  - Scrolling down minimises it to the current tab, and the accessory grows into a live strip ("Starfish, 17:00 · Up next"). Scrolling up restores it.
- **Sheets.** Choices and small forms open in a glass `Sheet`, inset 8px, with `radius-sheet` corners and a grab handle. The page behind pushes back. Long forms use a full-height sheet with an opaque `bg`.
- **Live banner.** Confirmations grow as a black `LiveBanner` at the top centre, then settle to a compact tick and time. Tapping it expands it again.
- **Safe areas.** Content clears `env(safe-area-inset-*)`, and the page scrolls under the bars.

## The page shell

- Every page is one `PageShell` with one `PageHeader` holding its one H1, as now (AGENTS.md, "Screens"). Step 5 rebuilds both in this design: the header gains the subtitle menu, the large-title collapse on phones and the sticky glass toolbar on desktop.
- A page leads with what needs the person: a "Needs you" list, or the "Not covered yet" lane. Then what is happening now (figures, the day). Then the rest.
- Sections are `title-3` headings above opaque grouped content, 26px apart. Cards and lists are `bg-2` with `radius-card` corners. Separators are inset hairlines; never boxes inside boxes.
- A page that shows the day uses `DayTimeline`: Calendar-style blocks with a 3px leading bar, and the red now line and pill. Blocks that overlap in time take rows of their own within their lane, as Calendar stacks them; a hairline parts one lane from the next.

## Components

These are the 2.0 kit, all shown live in the design system. Each rebuilds or replaces a piece of today's kit (`src/components/shadcn`, `src/components/ui-kit`). Radix behaviour stays where shadcn has it; the look changes. This contract approves the new components marked **new**.

| Component | Replaces or restyles | Notes |
| --- | --- | --- |
| `GlassRoot`, `Glass` | **new** | The material and the lens filters; `GlassRoot` sets the pointer light. Kit only: pages never style glass themselves. |
| `Button` (prominent, glass, bar, filled, tinted, plain, done) | `shadcn/button` | One prominent action per view. `bar` sits inside a glass group. |
| `MorphMenu` | `shadcn/dropdown-menu`, `popover` | The menu grows out of its button. |
| `SegmentedControl` (glass, solid) | `ui-kit/segmented-links`, `shadcn/tabs` | Two to five items; droplet. |
| `Switch` | `shadcn/switch` | Green when on; the knob turns to glass while held. |
| `Sidebar` | the module rail in `ModuleShell` | Desktop sidebar of apps; a symbol rail on tablet. |
| `TabBar` | the phone bottom bar in `ModuleShell` | Minimises on scroll; accessory. |
| `Toolbar`, `ToolbarGroup` | the frame's top row | Sticky; glass groups. |
| `Spotlight` | `shadcn/command` and the search tool | Actions, apps, people. |
| `List`, `ListRow` | `shadcn/item`, `ui-kit` rows | Inset grouped; tone, value, action, done. |
| `Tag` | `ui-kit/tag` | Same `StatusMeta` map; the tones become orange, blue, green, red and grey. |
| `Figure` | the `.pc-stats` tiles | Big tabular numbers. |
| `DayTimeline` | `TimelineGrid` | Lanes, blocks, the now line. |
| `ProgressRing`, `DoneMark` | `shadcn/progress` for sets of things | Registers, checks. |
| `Avatar` | `shadcn/avatar` | Initials only. |
| `Sheet` (with `Stage`) | `shadcn/sheet` | Glass, pushes the page back. |
| `Inspector` | **new** | Desktop side panel. |
| `Suggestion` | **new** | One person offered for a job, best first. |
| `LiveBanner` | **new**, beside `shadcn/sonner` | Phone confirmations. Desktop notifications restyle Sonner as glass with Undo. |
| Dialog, alert dialog, inputs, select, checkbox, radio, table, empty, skeleton, tooltip | the shadcn originals | Restyled to these tokens: opaque `bg-2` dialogs with `radius-card` corners, `fill` inputs at 44px, `radius-capsule` chips. |

Icons stay **Lucide** (lucide-react) at 1.9 stroke: 20px in rows, 24px in the tab bar, 18px in the sidebar. The selected tab uses a filled variant. No emoji.

## States

- **Loading.** The frame, title and section headings show at once. Content areas show `fill-2` placeholder shapes the size of what is coming, with a gentle fade. No full-page spinners. A button that saves keeps its width and shows its pending label.
- **Empty.** A symbol in a `fill-2` tile, one sentence saying what will appear here, and the action that adds the first item. An empty list of problems is good news: "Everything is covered" in green.
- **Error.** Say what failed and what to do, where it failed, with Try again; keep everything the person typed. A failed save keeps the change on screen, marked, until it is saved or undone.
- **Saved.** The change shows where it happened first (tick, roll, colour), then the confirmation: a notification on desktop, a live banner on phones. Undo is offered in the row that changed for a few minutes. Messages are past tense and plain: "Morgan is covering Main Pool, 17:00 to 17:30".

## Forms and confirmation

- Forms are inset grouped rows on `bg-2`.
  - Labels sit above groups in `footnote` `label-2`. Fields are 44px or more, with 16px text on touch.
  - Choices of two to five are a solid `SegmentedControl` or chips; longer lists open a menu.
  - Switches apply at once. Time defaults to now.
- On phones a form is a full-height sheet: a glass ✕ (Cancel) on the leading side, the title in the middle, and a prominent ✓ on the trailing side. The ✓ stays plain glass until the form can be sent. On desktop the same form is a page, or an inspector with Save at the foot.
- Sending ends on a moment: the form fades behind a drawn tick, with the result and who has it ("Report sent · I-0414 · The duty manager has it"), plus a confirmation.
- **Prefer undo to "Are you sure?".** Confirm only what cannot be undone (delete for good, send to a family, close a serious report). Use an alert dialog that names the thing and the consequence, with the destructive button in `red-ink`, worded as the action ("Delete report"), never "Yes".
- A choice that alerts other people says so before sending, in a `red-soft` note: "Serious report. Sending it alerts the duty manager and the centre manager straight away".

## The pool deck

The pool deck is used poolside on tablets, in wet hands, in bright light.
- Tablet frame (above). Rows and registers are 64px, and the whole row is the target.
- The register pattern:
  - a `ProgressRing`, the class and a live "On now · 20 min left"
  - one tap marks a swimmer here, a second marks them away, with a word as well as a mark
  - "All here" in the navigation bar
  - the save button reads "4 still to mark" until everyone is marked, then "Save register", then "Saved" with a live banner.
- Nothing depends on hover or fine pointing. Text is at least `body` (17px).
- Keep medical notes off the register list; a swimmer's notes open on their own record for those whose job needs them ([docs/apps.md](docs/apps.md)).

## Turnfin Me

Turnfin Me is the person's own app on their own phone, so it uses the phone frame only:
- large titles and a glass tab bar
- sheets for choices and forms
- live banners for confirmations
- the same tokens, its own copy of the kit (AGENTS.md, "Screens").

If Turnfin Me becomes a native iPhone app, its confirmations become real Live Activities, and the design does not change.

## Accessibility

- **WCAG 2.2 AA in both themes.**
  - Text 4.5:1, or 3:1 at 24px+ or bold 19px+. Marks and focus 3:1.
  - The checked pairs are in the design system's Accessibility section.
  - Apple's own secondary label, white on system green and white on system red miss AA; that is why `label-2` is 76%, and why `green-mark`, `on-green` and `red-badge` exist.
  - A filled shape with white text is `accent-btn`, never `accent`: `accent` is for blue text and marks.
  - The light inks (`green-ink`, `orange-ink`, `red-ink`) keep 4.5:1 on their soft ground over `bg` as well as over `bg-2`, because tags also sit on the page ground. A figure of nothing is `label-2`: `label-3` is never text.
- **Not by colour alone:** every status has a word or symbol.
- **Targets:** 44px at every width; whole rows on the pool deck.
- **Focus:** a 2px `accent` ring with a 2px offset. Overlays trap focus, close with Esc and return focus to the control that opened them. Spotlight and lists work with the arrow keys and Enter.
- **Roles:**
  - switches are `role="switch"`
  - segments are `aria-pressed` buttons
  - the current page or tab has `aria-current`
  - live banners and notifications are `role="status"` and read the whole sentence
  - icon-only buttons are named.
- **System settings:**
  - *Reduce motion* ends animations at once.
  - *Reduce transparency* makes glass opaque `bg-2`.
  - *Increase contrast* outlines glass.
  - *Forced colours* use system colours.

## Until it is built

- The live app keeps the pre-2.0 theme (`src/app/theme`, `src/app/shadcn.css`) until step 5 replaces each part. No two designs in one screen. Do not add the new look piecemeal to the old screens, or old-look ideas to new ones.
- The screen rules in [AGENTS.md](AGENTS.md) ("Screens") hold throughout.

## How it is built

Roadmap step 5, in this order. Each part removes the old look it replaces.

1. **The theme** (built 25 October 2026).
   - These tokens go into one theme file in `src/app/theme`, mapped into `src/app/shadcn.css`, in light and dark.
   - The springs, the glass material and the lens filters go into the kit.
   - `poolside.css` and the `--pc-*` tokens go when nothing uses them.
2. **The kit** (built 25 October 2026: the material, `GlassRoot` and `Glass`, and the shadcn primitives restyled: buttons, tags, switches, segmented controls, fields, glass menus, dialogs, cards, rows, figure tiles and tables. The new components follow with the screens that use them: `DayTimeline`, `Inspector`, `ProgressRing`, `DoneMark`, `Figure` (with Training) and `LiveBanner` (Turnfin Me) are built, the rest to come).
   - The components above, in `src/components/ui-kit`, built on the shadcn primitives.
   - The lint rules (AGENTS.md, "Enforcement") follow the new kit: the pointer light is set on a ref by `GlassRoot`, not by a `style` attribute.
3. **The frame** (built 25 October 2026; the large-title collapse on phones built 26 October 2026). `ModuleShell` becomes the sidebar, toolbar and tab bar frame. `PageShell` and `PageHeader` are rebuilt in this design.
4. **Home and the app frame** (Home built 25 October 2026, on the approved canvas), then each app (Rota's Plan, Incidents, Swim school's starter page, the shape of every app's, and the register on the desk and the pool deck, built 25 October 2026, on the canvas; Refunds and Coinage built 26 October 2026 as record pages (ui-kit/record.tsx), in the Incidents pattern, and Incidents moved onto the same pieces; Tasks built 26 October 2026; Stock built 26 October 2026; Turnfin Me's phone frame and every page built 26 October 2026; Training built 26 October 2026; the rest of Swim school and the pool deck built 26 October 2026, with the kit's time blocks and week strip; Analytics built 26 October 2026; Admin built 26 October 2026; Docs built 26 October 2026; Purchasing built 26 October 2026 as record pages, and its own stylesheet removed; the rest of Rota built 26 October 2026, and the old Plan's unused components and styles removed; HR built 26 October 2026; Short courses built 26 October 2026; CCTV log and Site Monitoring built 26 October 2026, and the tablet rail scrolls when taller than the window; Maintenance checked 26 October 2026, already on the pieces, with its form cards in record cards), one pull request each, checked in the running app at phone, tablet and desktop widths in light and dark.
5. **Turnfin Me and the Academy booking site,** with their own copies of the theme and kit.

## Screen checklist

- [ ] One job, for one kind of person; what needs them comes first, with its action in place.
- [ ] Ground `bg`, content `bg-2`, glass only on floating controls; no glass on glass.
- [ ] One prominent action at most; other buttons are glass, tinted or plain.
- [ ] Colour only for selected, needs action, done, now or serious, always with a word or symbol.
- [ ] Type from the scale; numbers tabular; staff words, sentence case, no codes.
- [ ] 44px targets (64px rows on the pool deck); focus visible; overlays trap and return focus.
- [ ] Every change shows where it happens and is confirmed, with Undo where it can be undone.
- [ ] Loading, empty, error and saved states designed.
- [ ] Springs, not eases; nothing moves without a reason; *Reduce motion*, *Reduce transparency*, *Increase contrast* and forced colours checked.
- [ ] Seen in the running app at phone, tablet and desktop widths, in light and dark, with synthetic data only.
