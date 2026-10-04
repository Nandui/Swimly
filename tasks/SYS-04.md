# SYS-04 — Type rules: no stray letter-spacing, one wordmark size, tabular times
Severity: medium | Scope: system

## Files (expected)
- DESIGN.md
- src/app/(core)/staff/[id]/page.tsx
- src/app/(core)/staff/organisation/page.tsx
- src/app/(instructor)/instructor/page.tsx
- src/app/docs/docs.css
- src/app/docs/poolside.css
- src/app/globals.css
- src/app/workspace/module-workspace.css
- src/components/auth-frame.tsx
- src/components/shadcn/alert.tsx
- src/components/shadcn/card.tsx
- src/components/shadcn/command.tsx
- src/components/shadcn/dropdown-menu.tsx
- src/components/shadcn/empty.tsx
- src/components/sign-in-form.tsx
- src/components/ui-kit/page-header.tsx
- src/components/ui-kit/prose.tsx
- src/components/workspace/brand.tsx
- src/modules/activities/components/analytics/dashboard.tsx
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/courses/class-detail.tsx
- src/modules/activities/components/enrolment/awaiting-queue.tsx
- src/modules/activities/components/students/swimmer-profile.tsx
- src/modules/activities/components/today/calendar.module.css

## Problem
DESIGN.md says 'No letter-spacing', but poolside.css gives every h2 (199) and dialog title (365) -0.01em. The owner-approved V2System sheet keeps -0.01em only on the page H1 (.page), with .title at 0. The Brand wordmark is 20px/700 at -0.02em, with a 13px sub-label (poolside.css @layer components ~425), so it sits off the five-size scale. Literal line heights remain: textarea 22px (:371) and .pc-block-time 18px (:556). globals.css:8-14 still defines a second Tailwind scale (lg 17px, xl 20px, 2xl 24px, 3xl 30px). Times next to tabular ones are proportional (instructor 16:00 heading, 16:30 end time, phone numbers). card.tsx uses leading-* utilities, and prose.tsx's Num is weight 500 and still exports an unused Badge-based 'Alert'.

## Change (original)
1) poolside.css: set letter-spacing 0 on h2 (199) and on dialog, alert-dialog and sheet titles (365). Keep -0.01em on h1 only (195), matching the V2System '.page'. In DESIGN.md:170 write 'No letter-spacing, except the H1 (-0.01em)'. 2) Brand wordmark rule: font-size var(--pc-text-title), line-height var(--pc-leading-title), weight 600, no letter-spacing; sub-label at caption size. 3) Replace the textarea line-height 22px with var(--pc-leading-body) and the .pc-block-time line-height 18px with a --pc-leading-* token. 4) Add `.turnfin-app :is(time, [data-figure]) { font-variant-numeric: tabular-nums; }`. 5) Delete globals.css:8-14 (the @theme text sizes); poolside.css:89-102 owns the scale. Add a line to DESIGN.md: markup never uses text-base, text-xl or text-3xl+. 6) Remove the leading-* utilities from card.tsx. In prose.tsx, set Num to font-semibold and delete the unused Alert export.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the goal; change the edits as follows.

1. Letter-spacing:
   - poolside.css:199 and :365: set letter-spacing 0. Keep -0.01em only on the h1 (:195).
   - Remove the letter-spacing declarations that actually win:
     - docs.css:47 (-0.35px legacy h2), :744 and :4350 (h1 -1px), :4356 (h2 -0.5px), :5014 (-0.5px).
     - module-workspace.css:48 (-0.01em on .module-panel h2).
     - calendar.module.css:3 (-.025em) and :23 (.01em).
     - poolside.css:377 (title-input -0.015em; use 0, or -0.01em if it counts as the H1).
   - Delete every `tracking-*` utility in markup (41 hits, `rg "tracking-(tight|tighter|wide|wider|widest)" src`). That includes:
     - src/components/ui-kit/page-header.tsx:17, sign-in-form.tsx:81, staff/[id]/page.tsx:64/82/103, staff/organisation/page.tsx:34/68, class-detail.tsx:166/210, class-session.tsx:330, analytics/dashboard.tsx.
     - shadcn alert.tsx:41, empty.tsx:64, command.tsx:169 and dropdown-menu.tsx:186.
   - DESIGN.md:170: write "No letter-spacing, except the H1 (-0.01em)".

2. Wordmark:
   - Delete the unused src/components/workspace/brand.tsx.
   - Delete all `.turnfin-brand`, `.turnfin-fin` and `.brand-wordmark` rules: poolside.css:210-212, 297-298, 415-416, 422-426 and the docs.css equivalents at 4757, 5749, 6138-6190.
   - In src/components/auth-frame.tsx:18, change `text-2xl font-bold` to `text-2xl font-semibold`. That gives 28px/600, and 24px on phones, matching AUSignIn.

3. Line heights:
   - poolside.css:371: textarea `line-height: var(--pc-leading-body)`.
   - poolside.css:556: .pc-block-time `line-height: var(--pc-leading-body)`.

4. Tabular times:
   - Don't add the `:is(time,[data-figure])` rule; it matches nothing.
   - Follow the existing pattern instead: add `tabular-nums` at (instructor)/instructor/page.tsx:95 (end time) and :160 (the group h2).
   - Audit other formatTime outputs the same way.

5. Phone type step-down:
   - poolside.css:179: change the selector to `.turnfin-app, .turnfin-docs, .turnfin-refunds`, matching the token block at :10-12, so page and figure sizes drop to 24px on phones.

6. Scale cleanup:
   - Delete globals.css:8-14.
   - In DESIGN.md, don't add a new line. Fix :29 to "Tailwind's text-xs, text-sm, text-lg and text-2xl map onto it" (the rule at :166-168 already bans the others).
   - Remove `leading-none` from card.tsx:37.
   - In prose.tsx, make Num `font-semibold` and delete the Alert export and the Badge import.

Acceptance:
- At 1280 light and 375 dark on /, /training/courses, /docs/work, /staff/sbx_ava and the Add swimmer dialog:
  - computed letter-spacing is 0 on every h2, h3 and dialog title;
  - the H1 is -0.28px at 1280, and 24px with -0.24px at 375.
- The /sign-in wordmark is 28px/600 at 1280 and 24px/600 at 375.
- On /instructor?tab=all the 16:00 h2 and the 16:30 end time compute tabular-nums.
- `rg "tracking-" src --glob '*.tsx'` returns nothing.
- typecheck and lint pass.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) Letter-spacing. In poolside.css, next to the unlayered h1 rule (:194-195), add an unlayered `.turnfin-app :is(h2, h3, h4) { letter-spacing: 0; }`. Drop the letter-spacing declarations from the @layer base h2 and h3/h4 lines (:199-200). Keep -0.01em on the h1 only. Set :365 (dialog, alert-dialog and sheet titles) to letter-spacing 0. Delete the stray declarations that still win over that rule:
- module-workspace.css:48, `letter-spacing: -0.01em` on `.module-panel h2`;
- calendar.module.css:3, the H1's `-.025em` (so the /schedule H1 gets the shared -0.01em);
- calendar.module.css:23, `.01em`.

As cleanup, delete the now-dead letter-spacing on docs.css:4350 and :4356. Remove `tracking-tight` from shadcn alert.tsx:41 (AlertTitle) and empty.tsx:64 (EmptyTitle), and `tracking-widest` from command.tsx:169 and dropdown-menu.tsx:186. Optionally strip the `tracking-tight` that is now dead on markup headings (page-header.tsx:17, staff/[id]/page.tsx, organisation/page.tsx and so on). Optionally set the docs editor title (poolside.css:377) to weight 600 and -0.01em, so it matches the H1 it stands in for. DESIGN.md:170 should read: "No letter-spacing, except the H1 (-0.01em)".

2) Wordmark. Don't edit the dead .brand-wordmark rule. Delete src/components/workspace/brand.tsx and the dead brand CSS:
- poolside.css:210-212, 297-298, 415-416 and the @layer components block at 419-427;
- docs.css: the brand block around 6137-6178, the .brand-wordmark selector at 4757, and 5749-5758.

The only live wordmark is the one in src/components/auth-frame.tsx:17. Change `font-bold` to `font-semibold` and keep `text-2xl` (page size: 28px, 24px on phones). That matches the approved AUSignIn mockup (.title at 28px/36px, weight 600).

3) Line heights. Textarea (poolside.css:371): replace 22px with var(--pc-leading-title), which gives 1.5 for the 16px phone text. In the existing `@media (min-width: 768px)` field block (~:409), add `.turnfin-app [data-slot='textarea']:not(.title-input) { line-height: var(--pc-leading-body); }`. For .pc-block-time (:556), use `line-height: var(--pc-leading-body)` and add `line-height: var(--pc-leading-caption)` to `.pc-block-time small`. The stack stays 36px; its only consumer is home-parts.tsx:216.

4) Tabular times. Don't add the global `:is(time, [data-figure])` rule. Add the existing `tabular-nums` utility to:
- src/app/(instructor)/instructor/page.tsx:160 (group heading h2) and :95 (end-time p);
- the phone links in awaiting-queue.tsx:78 and swimmer-profile.tsx:99 and :109.

5) Delete globals.css:8-14 and keep :7 (--font-sans). Keep poolside.css:89-102 unchanged, because markup still uses text-base (21 files), text-xl (31) and text-3xl or larger (7). Rewrite DESIGN.md:29 to agree with :166-167 ("markup uses only text-xs, text-sm, text-lg and text-2xl; text-base, text-xl and text-3xl are mapped only as a safety net") instead of adding a new line. Track the unmapped text-4xl/5xl in analytics/dashboard.tsx as follow-up work.

6) card.tsx: remove `leading-none` from CardTitle. prose.tsx: set Num to font-semibold, and delete both the Alert export and the `import { Badge }` line.

Acceptance, at 1280 light and 375 dark:
- Computed letter-spacing is 0 (or normal) on every h2, h3, h4 and dialog title on /, /training/courses, /docs/work, /staff/sbx_ava, /training/people/sbx_ava, /hr/people/sbx_ava, /schedule and the Add swimmer dialog.
- The H1 is -0.28px at 1280 (-0.24px at 375), including /schedule.
- The sign-in wordmark is 28px/600 at 1280.
- On /instructor?tab=all, the 16:00 h2 and the 16:30 end time compute to tabular-nums.
- Reshoot /training/courses at 375 to check that row titles losing -0.5px haven't started truncating.
- typecheck and lint pass.

## Acceptance
On /, /training/courses, /docs/work, /staff/sbx_ava and the Add swimmer dialog at 1280 light and 375 dark: computed letter-spacing is 0 on every h2, h3 and dialog title and -0.28px on the H1 at 1280. The sign-in wordmark is 18px/600. On /instructor?tab=all the 16:00 group heading and 16:30 end time are tabular. typecheck passes.

## Verification notes
- KEEP: The problem is real, but as written the change would not pass its own acceptance test. Checked in code, against V2System and AUSignIn, and with computed styles in the live sandbox.

What is real today:
- DESIGN.md:170 says "No letter-spacing", yet poolside.css:199 (h2) and :365 (dialog titles) set -0.01em. V2System keeps -0.01em only on `.page`; its `.title` has none.
- Literal line heights remain at poolside.css:371 (textarea 22px) and :556 (.pc-block-time 18px). The mockup textarea inherits 20px.
- globals.css:8-14 defines a second scale. Deleting it is harmless, because body is always .turnfin-app (layout.tsx:65) and poolside.css:89-102 re-points every text-* inside it.
- card.tsx:37 uses `leading-none`.
- prose.tsx:15 Num is weight 500, and its Alert export (:23) has no importer.

Defects in the change:

1. Fixing poolside.css:199 changes nothing anyone sees. That rule sits in `@layer base`, and the h2 values that actually win come from elsewhere:
   - docs.css:4356 `@layer components { :where(.turnfin-docs) h2 { letter-spacing:-0.5px } }`.
   - docs.css:47 (legacy layer, -0.35px).
   - `tracking-tight` utilities, which beat the base layer.
   Measured: h2 -0.5px on /, /training/courses and /docs/work (1280 light). On /staff/sbx_ava it is -0.45px at both 1280 light and 375 dark, from tracking-tight at staff/[id]/page.tsx:64, 82 and 103.

2. The wordmark rule is dead CSS. `.brand-wordmark` (poolside.css:425-426, 211-212, 297-298, 415-416; docs.css:4757, 5749, 6139-6190) is only used by src/components/workspace/brand.tsx, and nothing imports `Brand`. The only visible wordmark is src/components/auth-frame.tsx:18 (`text-2xl font-bold`), measured 28px/700, and 24px/700 at 375. The approved AUSignIn mockup draws it at 28px/36px/600. So "sign-in wordmark 18px/600" contradicts the mockup.

3. The tabular rule matches nothing. On /instructor?tab=all there are 0 `<time>` and 0 `[data-figure]` elements; the whole of src has 5 `<time` and no data-figure. The 16:00 heading is `h2.text-lg` at instructor/page.tsx:160 and the 16:30 end time is a `p.text-xs` at :95. Both compute font-variant-numeric: normal.

4. A related bug found in the same file: phone H1s don't step down. The token block at poolside.css:10-12 re-declares --pc-text-page:28px on `.turnfin-docs`, which hides the phone override at :179 (it targets `.turnfin-app` only). Measured: H1 28px at 375 on /staff/sbx_ava, but 24px on /sign-in. DESIGN.md and the mockup (`.phone .page` 24px) both say 24px on phones.

5. DESIGN.md:166-168 already says "use text-xs, text-sm, text-lg, text-2xl; never leading-*". The contradiction is at :29 ("text-xs to text-3xl map onto it"). Markup still has 59 text-base/xl/3xl+ uses, including off-scale text-4xl and text-5xl in analytics/dashboard.tsx.

Evidence:
- Screenshots in shots/audit2/sys04: sign_in-1280-light.png, sign_in-375-dark.png, preview_AUSignIn_html-1280-light.png, staff_sbx_ava-1280-light.png, staff_sbx_ava-375-dark.png, instructor_tab_all-1280-light.png.
- Computed-style probes in the scratchpad: sys04-expr.js to sys04-expr4.js.
- Not checked live: the Add swimmer dialog. Its title rule at :365 is unlayered, so it does win today (-0.01em), and setting it to 0 there will take effect.
- KEEP: The problem is real, but as written the change has no visible effect for three of its six parts, and one acceptance target goes against the owner-approved mockup. Evidence comes from computed styles on the live sandbox, read through the CDP eval scripts, with the change simulated by injecting CSS.

(1) h2 letter-spacing: setting 0 at poolside.css:199 does nothing. That rule sits in @layer base. ModuleShell puts .turnfin-docs on every module (module-shell.tsx:57), and docs.css:4354-4356 (@layer components, opened at docs.css:4333) sets `:where(.turnfin-docs) h2 { letter-spacing: -0.5px }`. The components layer beats base. Tailwind `tracking-tight` (utilities layer) also beats base, for example on staff/[id]/page.tsx:64/82/103. Measured: h2 is -0.5px on /, /training/courses and /docs/work, and -0.45px on /staff/sbx_ava. After the simulated base-layer edit the values were "unchanged". An unlayered `.turnfin-app :is(h2,h3,h4){letter-spacing:0}` makes every heading 0 on /, /training/courses, /docs/work, /staff/sbx_ava, the swimmer profile and the document page, at 1280 light and 375 dark. Two pages still miss: /training/people/sbx_ava and /hr/people/sbx_ava, where module-workspace.css:48 `.module-panel h2` (-0.01em) gives -0.18px. /schedule also misses: calendar.module.css:3 gives the H1 -0.7px and :23 gives the programme h2 0.14px. The dialog-title edit at :365 works: Add a swimmer went from -0.18px to normal at 1280 light and 375 dark.

(2) Wordmark: .brand-wordmark is dead CSS. src/components/workspace/brand.tsx has no importers, and no markup uses .brand-wordmark, .turnfin-brand, .turnfin-fin or .workspace-brand-row. The visible sign-in wordmark is in src/components/auth-frame.tsx:17 (`text-2xl font-bold`), measured at 28px/700. The approved AUSignIn mockup draws it as `.title` at 28px/36px, weight 600, so the 18px/600 acceptance target is wrong.

(3) Textarea: switching 22px to --pc-leading-body (20px) also hits phones, where the field text is 16px (poolside.css:370). That tightens multi-line notes from 1.375 to 1.25.

(4) Tabular times: the instructor page has no <time> elements, and no element in the codebase has `data-figure`. Measured on /instructor?tab=all: the H2 "16:00" and the P "16:30" both have font-variant-numeric normal. A global rule would change nothing there and adds a concept the codebase doesn't use. The `tabular-nums` utility already exists, in 59 places.

(5) Deleting globals.css:8-14 is safe. <body> always has .turnfin-app (layout.tsx:65), there is no global-error or second <html>, and poolside.css:89-102 overrides the tokens. CSS modules that use var(--text-*) resolve inside that scope. DESIGN.md:166-167 already limits markup to xs/sm/lg/2xl, but DESIGN.md:29 says "text-xs to text-3xl map onto it", so fix line 29 rather than adding a new line.

(6) card.tsx: CardTitle, the only element with leading-none, has no consumers, so there is zero runtime effect. prose.tsx: Alert has no importers. Deleting it leaves `import { Badge }` unused, so that import has to go too or lint will flag it.

No lint boundary, permission or form behaviour is affected.