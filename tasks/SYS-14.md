# SYS-14 — Frame (ModuleShell): bottom bar, page bar, site picker, focus, rail and skip link
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- public/brand/turnfin.png
- scripts/check-reception-portal.mjs
- scripts/help-screenshots/capture.mjs
- scripts/help-screenshots/fixture.jsx
- scripts/sandbox.mts
- src/app/docs/docs.css
- src/app/docs/poolside.css
- src/app/layout.tsx
- src/components/clubs/club-switcher.tsx
- src/components/help/help-frame.tsx
- src/components/home/home-shell.tsx
- src/components/shadcn/dropdown-menu.tsx
- src/components/staff/role-preview.tsx
- src/components/ui-kit/app-shell.tsx
- src/components/workspace/account-menu.tsx
- src/components/workspace/module-shell.tsx
- src/components/workspace/your-modules.tsx
- src/lib/clubs/current.ts
- src/lib/help/guides-start.ts
- src/lib/help/screenshots.ts
- src/lib/home.test.ts
- src/lib/home.ts
- src/lib/staff/session-user.ts
- src/modules/activities/components/app-nav.tsx
- src/modules/activities/components/instructor/instructor-shell.tsx
- src/modules/context.ts
- src/modules/registry.ts

## Problem
In the bottom bar, More is a shadcn ghost Button: `.ui-motion-press[data-variant=ghost]` (0,3,0) beats `.tf-bottom-item` (0,2,0), so it is blue like the current module, 44px tall against 56px, wider than the other items, and for ava it holds only Help. On touch tablets the page bar keeps an 88px indent, because the tablet rule (0,3,0) beats the touch reset, and the bottom bar stretches 1008px. Long module names ('HR and performance') overlap neighbouring bottom-bar labels. The site switcher is clipped to 'LeisureWorld Bishopsto…' by max-width 180px (poolside.css:472) with room to spare; it uses ChevronsUpDown, sits before search, and on phones is a 70px two-icon button labelled 'Working area'. The focus ring on the current bar item is the same blue as its fill (1.00:1). The bar scrolls sideways (hidden scrollbar) before measuring on first paint. More flattens the grouped pages. A module with one page still gets a one-item bar. The rail lists modules with no openable screen at the working site (maya sees Swim school, then an empty overview and 404s). Building2 means both Admin and site. The View as active state is overridden by the tf-tools reset. Rail, bottom bar and page bar mark up to four links aria-current='page'. Help opens in new tabs. Frame literals: radius 36px, a bottom-bar shadow in an rgb literal, max-width 1100px against DESIGN's 1099px. There are three skip-link implementations; the frame's comes from legacy docs.css (6px radius, weight 400).

## Change (original)
1) Bottom bar: render More as a plain <button type='button' className='tf-bottom-item'> inside DropdownMenuTrigger asChild (no Button). When the rest list is empty, render Help as a direct tf-bottom-item link instead of More. Add `.tf-bottom-item > span:last-child { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }`. 2) Touch block: `.turnfin-app .tf-shell .tf-pages { margin-left: 0; }` and `.turnfin-app .tf-bottom { max-width: 480px; margin-inline: auto; }`. Change the tablet media query to max-width 1099px, matching DESIGN.md. 3) Site switcher (club-switcher.tsx and app-nav.tsx): delete the 180px max-width (useBarFit moves page links into More first); use ChevronDown; order the tools search, then site, then account. On phones it is a 44px icon button (Building2, aria-label '<site>, change site'). The menu label is 'Your site', the toast 'Now working at <site>' and errors 'Check the site'. Export the tools fragment from app-nav.tsx so Home can reuse it. 4) Focus: on the current bar and rail items and filled More, set outline: none on focus-visible and give ::before box-shadow 0 0 0 2px var(--pc-surface), 0 0 0 4px var(--pc-focus), var(--pc-focus-halo) (on .tf-bottom-icon for the bottom bar). Drop the !important at poolside.css:465 if the ghost hover no longer competes. 5) .tf-bar inside .tf-pages: overflow hidden, flex-wrap wrap, height 44px (no hidden scroll strip before measuring). PagesMore renders the overflowing groups with a DropdownMenuLabel (caption, muted) per group. Render no .tf-pages bar when a module has one page link. 6) Rail and bottom bar use aria-current='true' for the current module; the page bar uses 'true' when the path is a descendant and 'page' only on the exact page. The Help links in the rail and bottom More open in the same tab (remove target=_blank). 7) The rail comes from screen visibility at the working site: modulesFor in src/app/layout.tsx, visibleModules in registry.ts:88-90 and context.ts list a module only when at least one of its screens opens at the working site. Give Admin the lucide Settings icon (registry.ts:247). 8) View as (role-preview.tsx): side='bottom'; add `.turnfin-app .tf-tools > .workspace-preview-toggle[aria-pressed='true']::before { background: var(--pc-primary-soft); }` with colour --pc-primary-ink after the tf rules; caption 'Viewing as <role>'. 9) Literals: add --pc-radius-frame: 36px and use it on .tf-frame; .tf-bottom uses var(--pc-shadow-overlay); crop the fin PNG once instead of 'margin: -4px; transform: translateX(3px)' (or keep the image and remove the transform if the crop lands). 10) Skip link: define .skip-link once in poolside.css (fixed top and left 16px, pill radius, min-height var(--pc-control-height), padding var(--pc-control-pad), weight 600, --pc-primary on --pc-on-primary, off-screen until :focus-visible). Label it 'Skip to content' in ModuleShell. Delete docs.css:382-395 and 4128-4130. The deck and Help adopt it in DK-01 and HP-01.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Apply SYS-14 as written, with these changes.

1) Bottom bar. Render More as a plain <button type='button' className='tf-bottom-item'> inside DropdownMenuTrigger asChild. When the rest list is empty, render Help as a direct tf-bottom-item link instead of More. Do not truncate labels with an ellipsis: DESIGN's checklist says no clipped labels. Instead give items `flex: 1 1 0; min-width: 0` and let the label wrap to at most two centred lines: `.tf-bottom-item > span:last-child { white-space: normal; text-align: center; text-wrap: balance; }`. Items stretch, so all of them share one height. Check /hr at 375.

2) Touch block. Add `.turnfin-app .tf-shell .tf-pages { margin-left: 0; }`, which matches the mockup's own touch reset. Change the tablet query to max-width 1099px, as in DESIGN.md:90. The `.tf-bottom { max-width: 480px; margin-inline: auto; }` cap is optional polish; the mockup does not have it.

3) Site switcher (club-switcher.tsx, app-nav.tsx).
- Delete the 180px cap at poolside.css:472.
- Use ChevronDown.
- Order the tools search, then site, then account, as in V2Overview and V2Duty.
- On phones, make it a 44px icon button with Building2. Use the mockup's terms: aria-label 'Working site: <site>. Change site', menu label 'Working site', toast 'Now working at <site>', error 'Could not change site. Try again.'
- Export the tools fragment so Home can show search, site and account, as V2Home does.

4) Focus. On the current bar item, the current rail item and a filled More, set outline: none on :focus-visible. On ::before (on .tf-bottom-icon for the bottom bar), set box-shadow: 0 0 0 2px var(--pc-surface), 0 0 0 4px var(--pc-focus), var(--pc-focus-halo). KEEP the !important at poolside.css:465 (or raise its specificity, e.g. `.tf-bar-item[aria-current]:is(:hover, :not(:hover))::before`). It guards the current pill against the :hover::before rule at :463, not against the ghost variant.

5) Page bar. Give .tf-pages .tf-bar overflow: hidden, flex-wrap: wrap and height 44px. PagesMore shows a DropdownMenuLabel (caption, muted) for each group. Render no .tf-pages bar when a module has one page link.

6) aria-current. The rail and bottom bar use aria-current='true' for the current module. The page bar uses 'true' when the path is a descendant and 'page' only on the exact page; CSS keeps matching on [aria-current]. LEAVE the Help links opening in a new tab: DESIGN.md:293-294 requires it, and account-menu.tsx:48 and your-modules.tsx:58 do the same.

7) Rail. Do NOT change modulesFor, visibleModules or context.ts. Listing modules held anywhere is deliberate (context.ts:5-8, also used by home.ts:23). maya's empty Swim school comes from src/lib/clubs/current.ts:25 falling back to clubs[0], a site she does not work at. Raise it as a separate access task: the working site should default to the person's own sites (User.siteIds), and the picker should list only those sites. Give Admin the lucide Settings icon (registry.ts:247) so Building2 means only the site. Note that this departs from V2Duty, where Admin uses Building2.

8) View as (role-preview.tsx). Set side='bottom'. Add `.turnfin-app .tf-tools > .workspace-preview-toggle[data-active='true']::before { background: var(--pc-primary-soft); }` and colour var(--pc-primary-ink), placed after the tf rules. The component sets data-active, not aria-pressed. Delete the dead rule at poolside.css:238. Caption: 'Viewing as <role>'.

9) Literals. Add --pc-radius-frame: 36px and use it on .tf-frame. .tf-bottom uses var(--pc-shadow-overlay). Crop the fin PNG once and remove 'margin: -4px; transform: translateX(3px)'.

10) Skip link. Define .skip-link once in poolside.css under .turnfin-app:
- fixed, top and left 16px;
- radius var(--pc-radius-control), min-height var(--pc-control-height), padding var(--pc-control-pad);
- weight 600, --pc-primary background with --pc-on-primary text;
- off-screen until :focus-visible.
Label it 'Skip to content' in ModuleShell. Delete docs.css:382-395. At docs.css:4126-4130, remove only the `:where(.turnfin-docs) .skip-link` selector (line 4128) and end line 4127 with ` {`, so .brand-mark and .button.primary keep their colour. Delete the unused src/components/ui-kit/app-shell.tsx, which holds a fourth skip link. The deck and Help adopt the shared skip link in DK-01 and HP-01.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep SYS-14 as specified, with these corrections:

1) Bottom bar. Render More as `<DropdownMenuTrigger className="tf-bottom-item">…</DropdownMenuTrigger>` with no asChild and no Button. Radix renders `<button type="button">`, which passes the lint rule that forbids a raw `<button>`. Do the same for PagesMore: `<DropdownMenuTrigger className="tf-bar-item" aria-current={active ? 'true' : undefined}>`. That removes the ghost-variant colour clash there too. When `rest` is empty, render Help as a direct tf-bottom-item `<a href="/help" target="_blank" rel="noopener noreferrer">` with the sr-only text "(opens in a new tab)". Add `.turnfin-app .tf-bottom-item { flex: 1 1 0; min-width: 0 }` and `.tf-bottom-item > span:last-child { max-width: 100%; overflow: hidden; text-overflow: ellipsis }`.

2) Touch block, as specified: `.turnfin-app .tf-shell .tf-pages { margin-left: 0 }` and `.turnfin-app .tf-bottom { max-width: 480px; margin-inline: auto }`. Change the tablet query to max-width 1099px.

3) Site switcher. Replace max-width 180px at poolside.css:472 with a wider cap, `max-width: 28ch`, so a very long name still truncates. Do not remove it. Use ChevronDown. In app-nav.tsx, order the tools as search, then ClubSwitcher; RolePreviewToggle and the account stay last. Make the phone icon-only state in CSS under `.tf-tools`, so the deck follows too:
- at max-width 767px, `.tf-tools > [data-slot='dropdown-menu-trigger']:not(.tf-who) > span + svg { display: none }` and `width: 44px; padding: 0`;
- never use `svg:last-child`, because it blanks the icon-only search, View as and Docs search buttons.

Copy:
- aria-label `${club.name}, change site`;
- menu label 'Your site';
- toast 'Now working at <site>';
- error 'Could not switch sites. Check the site and try again.'

In the same change, update the copy's other consumers:
- scripts/help-screenshots/capture.mjs:22-23, the click names;
- scripts/check-reception-portal.mjs:29-31;
- src/lib/help/screenshots.ts:17-18, captions and alt text;
- src/lib/help/guides-start.ts:26, which says the selector is "in the sidebar or phone toolbar"; it is now in the top bar.

Then check the deck (instructor-shell.tsx:81) at 768 and 1024. Do NOT export a tools fragment from app-nav.tsx for Home: Core and Work files may not import Activities. If Home needs the site picker, home-shell.tsx renders the Core `ClubSwitcher` (src/components/clubs) directly, fed by getCurrentClub() in loadHome. Home gets no swimmer search.

4) Focus. On `.tf-bar-item[aria-current]`, `.tf-rail-item[aria-current]` and `.tf-bottom-item[aria-current]`, set `:focus-visible { outline: 2px solid transparent }`, not `outline: none`, so forced-colors mode still shows focus. Then add the ring `box-shadow: 0 0 0 2px var(--pc-surface), 0 0 0 4px var(--pc-focus)` on `::before`, or on `.tf-bottom-icon` for the bottom bar. The --pc-focus-halo has the same 4px spread and adds nothing here. KEEP the !important at poolside.css:465, or replace it with `.turnfin-app .tf-bar-item[aria-current]:is(:hover, :focus-visible)::before { background: var(--pc-primary) }` placed after line 463. The generic hover rule is (0,4,1), so without one of these the current item turns grey under white text.

5) Scope the bar change to the frame: `.turnfin-app .tf-shell .tf-pages > .tf-bar { overflow: hidden; flex-wrap: wrap; height: 44px }`. The deck's bar has no More, so it must not get overflow hidden. PagesMore receives the groups and renders a muted caption DropdownMenuLabel for each group with a non-empty label. Render the .tf-pages nav only when pages.length > 1. When it is skipped, still render `<span className="sr-only">{scopeNote}</span>` in the header.

6) aria-current. The rail and bottom bar use 'true'. In the page bar, an active link gets 'page' only when `pathname === page.href.split('?')[0]` and 'true' otherwise; this is safe with the Refunds query hrefs. The PagesMore trigger gets 'true'. KEEP Help in a new tab everywhere (DESIGN.md:293-294, guides-start.ts:14) and do not remove target=_blank.

7) Rail visibility. Leave visibleModules, modulesFor and src/lib/home.ts semantics unchanged. They are the documented "anywhere" list, and home.test.ts covers them. Fix the root cause in src/lib/clubs/current.ts instead. When the cookie is missing or names a site outside a non-empty User.siteIds, fall back to the person's primaryClubId or first siteId rather than clubs[0], and pass the switcher only the clubs in siteIds. An empty siteIds still means every site. If a rail-only filter is still wanted, add `modulesHere(session)` in context.ts. It counts permissionsOf(session) plus the permissions of grants with scopeKind 'reports'. Never count only working-site permissions, because HR "Their team" exists only in team grants (session-user.ts:70) and liam would lose HR. Use it only for YourModulesProvider in layout.tsx. Give Admin the lucide Settings icon (registry.ts:247).

8) View as. Use the selector `.turnfin-app .tf-tools > .workspace-preview-toggle[data-active='true']`, not `[aria-pressed]`. Give it `color: var(--pc-primary-ink)`, and its `::before` `background: var(--pc-primary-soft)`, placed after poolside.css:463. Set side='bottom'.

9) Literals. Add `--pc-radius-frame: 36px` and use it on .tf-frame. .tf-bottom uses var(--pc-shadow-overlay). Do NOT edit /brand/turnfin.png: auth-frame, brand.tsx with .turnfin-fin, help-frame, the deck and the favicons all depend on its padding. Leave the .tf-brand img offsets as they are.

10) Skip link. Add `.turnfin-app .skip-link` to poolside.css:
- position fixed, top and left 16px, z-index 60 (above the bottom bar's 40);
- pill radius, min-height var(--pc-control-height), padding 0 var(--pc-control-pad);
- inline-flex, centred, weight 600, var(--pc-primary) on var(--pc-on-primary);
- off-screen via transform until :focus-visible.
Delete docs.css:382-395. At 4126-4130, remove ONLY the selector `:where(.turnfin-docs) .skip-link` and end line 4127 with ` {` so the rule reads `.brand-mark, .button.primary { color: var(--ui-primary-foreground); }`. Do not delete lines 4128-4130 as a block. Keep the print rule at 4182.

Verify with `npm run typecheck`, `npm run lint` and the acceptance list. Also check the deck header at 375, 768 and 1024, and /hr as liam (HR still in the rail, and the scope note still read out).

## Acceptance
At 375 light and dark and with touch emulated at 768 and 1024: the bottom-bar items share one height and muted ink; only the current module is blue; ava gets a direct Help item; the page bar lines up with the H1; no labels overlap on /hr pages. At 1280, 1024 and 768 the site name shows in full with ChevronDown. Keyboard focus on the current bar item shows a visible ring in both themes. Maya's rail omits Swim school when no screen opens. /hr as liam shows no one-item bar. Tab from the address bar shows a 44px pill 'Skip to content' on every ModuleShell page. Each page has at most one aria-current='page'.

## Verification notes
- KEEP: The problem is real. I checked the code and took live screenshots (C:/Users/ferna/AppData/Local/Temp/claude/D--turnfin/760493c3-af54-4763-90d6-8462f74488de/scratchpad/sys14s).

What I confirmed:
(1) Bottom-bar More. It is a ghost Button, so poolside.css:346 makes it --pc-primary. It is the same blue as the current module: rgb(29,95,209) in light, rgb(120,166,255) in dark. It is 44px tall against the other items' 56px and wider than them (167px vs 139px at 768 touch; crop-768bottom.png, crop-ava-bottom.png). For ava it holds only "Help (opens in a new tab)".
(2) Touch tablets. At 768 and 1024 with touch, the page bar keeps margin-left 88px: the bar starts at x=137 and the H1 at x=49. The bottom bar is 1008px wide at 1024. The mockup itself resets this indent under (hover:none) and (pointer:coarse), so the fix matches it.
(3) /hr at 375. The 'HR and performance' label is 119px inside a 103px item and overlaps 'Pool deck'. 'Swim school' overlaps too (hr-375.png).
(4) Site switcher. The span is 181px against a 180px cap, so it shows 'Bishopsto…' (crop-site.png). It uses ChevronsUpDown and sits before search. On phones it is a 70px two-icon button labelled 'Working area: …'. The mockup (V2Overview, V2Duty) puts search first, then site, then account, and uses ChevronDown.
(5) Focus on the current bar item. The inset 2px outline merges with the blue fill at the sides; only a thin sliver shows at top and bottom, in both themes (focus-bar-light-z.png, focus-bar-dark-z.png).
(6) aria-current. Three links say 'page' on /training and /hr: the page bar, the rail and the bottom bar. A filled More adds a fourth.
(7) Building2 is used for Admin (registry.ts:247) and for the site picker.
(8) View as. Its active rule (poolside.css:238, specificity 0,3,0) loses to the tf-tools reset at :460 (0,3,0, later in the file).
(9) Literals. The frame has a 36px radius, the bottom bar has an rgb() shadow that only suits light mode, and the tablet query says max-width 1100px while DESIGN.md:90 says 1099px.
(10) Skip link. It renders at 6px radius and weight 400 (skip-light-z.png). There are three more implementations: help-frame.tsx:13, the dead ui-kit/app-shell.tsx:37 (nothing imports it) and the deck's.
(11) One-item bars. maya sees only Overview on /swim-school (maya-ss.png) and liam sees only People on /hr.
(12) More flattens groups. The prop comment at module-shell.tsx:32 promises group names in More, but PagesMore gets a flat list.

Most of the change matches DESIGN v2 and the mockups. Six parts need amending:
(a) Help in a new tab. DESIGN.md:293-294 says "The module rail and the account menu open Help in a new tab", and account-menu.tsx:48 and your-modules.tsx:58 do so. Removing target=_blank from the rail only would contradict a documented rule and make Help inconsistent.
(b) Rail visibility. context.ts:5-8 deliberately lists modules a person holds anywhere, and home.ts:23 uses the same list. maya's empty Swim school has a different cause: getCurrentClub (src/lib/clubs/current.ts:25) falls back to clubs[0], Bishopstown, but her only site is Churchfield (scripts/sandbox.mts:83). Hiding Swim school would leave her stuck, because the only site picker is inside Swim school (app-nav.tsx) and her Home has none (maya-home.png).
(c) View as selector. role-preview.tsx:38 sets data-active, not aria-pressed, so the proposed [aria-pressed='true'] rule would never match.
(d) docs.css deletion. Lines 4126-4127 are earlier entries in the same selector list (they end in commas). Deleting 4128-4130 would fold .brand-mark and .button.primary into the font-size rule at 4131 and drop their colour.
(e) The !important at poolside.css:465. It protects the current item from the :hover::before rule at :463 (0,4,1 beats 0,3,1). The ghost variant is not the reason, so it must stay.
(f) Ellipsis on bottom-bar labels. Truncating them breaks DESIGN's "no clipped labels" check and the owner's "nothing clipped".

Smaller points:
- The Admin Settings icon and the phone site icon button both depart from the mockup. V2Duty uses Building2 for both Admin and site, and hides the site control on phones (hide-sm). Both changes are still defensible: one meaning per icon, and phones need a way to change site.
- The menu label should keep DESIGN's and the mockup's term, 'Working site'.
- The 480px bottom-bar cap is not in the mockup, but it does not contradict any rule.
- KEEP: The direction of SYS-14 is sound and every problem it names is real. As written, though, ten of its steps would break something, which shows up at lint time, in the CSS, or in permissions. Each one can be fixed by amending the step, so nothing here needs a refutation.

(1) Step 1's raw `<button>` fails `npm run lint`. I checked this with `npx eslint --stdin --stdin-filename src/components/workspace/module-shell.tsx`, which reports no-restricted-syntax: "Use the installed shadcn primitive". No raw button exists anywhere in src.

(2) Step 3, Home reusing a tools fragment exported from app-nav.tsx, also fails lint. I checked it with `eslint --stdin` on src/components/home/home-shell.tsx, which reports no-restricted-imports: "Core and Work modules must not import Activities".

(3) Dropping the !important at poolside.css:465 makes the current page item go grey under white text. The generic `:hover::before` rule at :463 has specificity (0,4,1), which beats `.tf-bar-item[aria-current]::before` at (0,3,1), and it has nothing to do with the ghost variant. PagesMore also stays a ghost Button. Its `.ui-motion-press[data-variant=ghost]:hover` rule (0,4,0) already paints --pc-primary-ink text on the filled blue More.

(4) Step 8's `[aria-pressed='true']` never matches. RolePreviewToggle is a Radix menu trigger and sets data-active="true" (role-preview.tsx:38).

(5) Step 7 would take HR away from liam. HR "Their team" permissions exist only in team grants (session-user.ts:70, levels.ts:87). They are never in session.user.permissions, so visibleScreens(permissionsOf(session)) and canSee leave HR out. modulesFor also feeds src/lib/home.ts. Its "anywhere" behaviour is deliberate (context.ts:6-8, covered by home.test.ts). The real cause of maya's empty Swim school is elsewhere: getCurrentClub falls back to clubs[0] and ignores User.siteIds (src/lib/clubs/current.ts:25). So maya lands at Bishopstown, where she has no site permissions, and the module reaches her rail through her Churchfield grant.

(6) Deleting docs.css:4128-4130 word for word leaves line 4127 `:where(.turnfin-docs) .button.primary,` with a dangling comma. The `.brand-mark, .button.primary` list then merges into the font-size rule at 4131, which drops their colour and makes .brand-mark caption-sized.

(7) Cropping /brand/turnfin.png breaks every other place that relies on its padding: auth-frame.tsx:15 (size-[170%]), brand.tsx with .turnfin-fin (76px inside 38x40), help-frame.tsx, instructor-shell.tsx and six favicons.

(8) Opening Help in the same tab contradicts DESIGN.md:293-294 ("The module rail and the account menu open Help in a new tab") and the user guide in src/lib/help/guides-start.ts:14. The account menu and the deck would still open new tabs.

(9) `.tf-pages .tf-bar { overflow: hidden }` also matches the deck's own bar (instructor-shell.tsx:74-75). The deck has no More fallback, so any link that doesn't fit would just disappear.

(10) Not rendering the bar for a one-link module also removes the only place scopeNote is rendered. For HR that is "Restricted · every read is logged".

Further issues to amend:
- ClubSwitcher is shared with the deck (instructor-shell.tsx:81) and the help fixture. Its copy change breaks scripts/help-screenshots/capture.mjs:22-23 (it clicks by the 'Working area: … Switch site' name) and scripts/check-reception-portal.mjs:29-31. It also leaves the help captions in src/lib/help/screenshots.ts:17-18 and the guide in guides-start.ts:26 out of date.
- Hiding the phone chevron with `svg:last-child` would blank the icon-only search, View as and Docs search buttons.
- `outline: none` with a box-shadow ring is invisible in forced-colors mode.
- The new skip link has no z-index, while the bottom bar sits at 40.
- Deleting the 180px cap with no replacement means a long site name never truncates.
- Marking 'page' only on the exact page has to compare against the href's path, because the Refunds hrefs carry query strings.

Safe as written:
- The touch-block margin reset wins on source order at equal specificity (0,3,0).
- A fixed bar with max-width 480px and margin-inline auto centres correctly.
- CSS that matches `[aria-current]` by presence still works with 'true'.
- The skip-link label checks in scripts/check-*.mjs keep working because the label stays 'Skip to content'.
- No test asserts aria-current on the rail.
- DESIGN.md already says 768-1099px.