# SYS-01 — One theme scope: remove the Docs adapter overrides from every module
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- src/app/(activities)/layout.tsx
- src/app/(core)/layout.tsx
- src/app/docs/docs.css
- src/app/docs/integration.css
- src/app/docs/layout.tsx
- src/app/docs/poolside.css
- src/app/hr/layout.tsx
- src/app/page.tsx
- src/app/refunds/layout.tsx
- src/app/rota/layout.tsx
- src/app/shadcn.css
- src/app/training/layout.tsx
- src/components/core/shell.tsx
- src/components/docs/shell.tsx
- src/components/home/home-shell.tsx
- src/components/hr/actions.tsx
- src/components/hr/shell.tsx
- src/components/refunds/shell.tsx
- src/components/rota/absences.tsx
- src/components/rota/actions.tsx
- src/components/rota/activities.tsx
- src/components/rota/bookings.tsx
- src/components/rota/roster.tsx
- src/components/rota/segments.tsx
- src/components/rota/shell.tsx
- src/components/shadcn/sheet.tsx
- src/components/training/certificate-actions.tsx
- src/components/training/manage-actions.tsx
- src/components/training/shell.tsx
- src/components/workspace/module-shell.tsx
- src/lib/home.ts
- src/modules/activities/components/app-nav.tsx
- src/modules/activities/components/students/add-swimmer.tsx

## Problem
integration.css is loaded after poolside.css (every module layout imports it) and overrides the v2 system rules at equal specificity. Every plain Button becomes a 12px rectangle (:30), while Radix triggers and portalled dialogs stay pills, so the same page mixes the two shapes on 55 of 69 routes. Tags drop to weight 500 (:31). Text is forced to 14px (:24). Every button, role=switch included, gets a 44px min-width with !important (:44, :26, :46), which turns the course switch into a grey blob. Radios get an 18px min-height, so the Appearance options are 36px (:27). The 44px dialog close works only inside .turnfin-docs (:29). The adapter variables repeat poolside.css:152-175 with a conflicting --radius. ModuleShell puts .turnfin-docs on every module (module-shell.tsx:57), so the legacy docs.css rules (h2 at -0.5px) reach Swim school, HR, Rota, Admin and Home. poolside.css:10-12 also redeclares the tokens on .turnfin-docs, so the phone step-down (H1 and figures at 24px) never reaches ModuleShell pages. Module layouts re-import poolside.css and the four font weights, read retired sidebar cookies, and pass props ModuleShell ignores (pageLabel, initialCollapsed, base). HR, Training and Rota add 'turnfin-docs' to their portals, so their dialogs look different from the rest.

## Change (original)
1) integration.css: delete lines 2-19 and 21 (adapter variables that poolside.css already defines; keep --reading-size until DC-02) and lines 24, 26, 27, 28, 29, 30, 31, 44, 45 and 46. Keep the Docs-only layout lines (32-43, 47-57). 2) poolside.css: put the token block (lines 10-12) on .turnfin-app only, removing '.turnfin-docs, .turnfin-refunds'. Collapse the duplicated '.turnfin-app,\n.turnfin-app' selector at 185-186. Set --ui-radius: var(--pc-radius-card) at 148 so any remaining var(--ui-radius) user lands on 16px. 3) module-shell.tsx:57: the root becomes 'turnfin-module turnfin-${id} tf-shell'. Docs adds 'turnfin-docs' and Refunds adds 'turnfin-docs turnfin-refunds' through their own content wrapper in docs/shell.tsx and refunds/shell.tsx, as DESIGN.md and AGENTS.md require (Docs and Refunds shell rules stay on .turnfin-docs). Before removing the class, grep docs.css for :where(.turnfin-docs) rules that frame elements rely on and move each one into poolside.css under .turnfin-app. Known cases: the .avatar look used by the top-bar Avatar in .tf-who (sunken fill, 12px/600 initials); the skip link is handled by SYS-14. 4) Remove the pageLabel, initialCollapsed and base props from ModuleShell's type and stop passing them from the core, hr, training, rota, refunds and docs shells, home-shell.tsx (also rename module 'Hub' to 'Home') and app-nav.tsx. Delete the sidebar-cookie reads in the seven module layouts and lib/home.ts (turnfin.home.sidebar and the 'collapsed' value). 5) Layout imports: (core), hr, training and rota import only ../workspace/module-workspace.css (drop docs.css, integration.css, poolside.css and the @fontsource imports); (activities) drops docs.css and integration.css; refunds and docs drop poolside.css and @fontsource (the root layout loads them) and keep docs.css, integration.css, editor.css and refunds.css. 6) Change the THEME constants in hr/actions.tsx, rota/*.tsx and training/*-actions.tsx to 'turnfin-module'. Update DESIGN.md:141 to say the theme comes from body.turnfin-app and the portal class only scopes module layout CSS.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep SYS-01 as specified, with these corrections:

1. integration.css: delete lines 3-19 and 21, not 2-19. Keep the '.turnfin-docs {' selector on line 2, plus --reading-size (20), font-family (22), color (23) and the closing brace (25). Delete lines 24, 26, 27, 28, 29, 30, 31, 44, 45 and 46 as stated.

2. poolside.css:
   - Do steps 2a to 2c as stated: tokens on .turnfin-app only, collapse the duplicate selector at 185-186, and set --ui-radius: var(--pc-radius-card) at 148.
   - In the same change, add three rules under .turnfin-app:
     (a) `.turnfin-app :is([data-slot='dialog-close'], [data-slot='sheet-close']) { display: inline-flex; align-items: center; justify-content: center; min-width: var(--pc-control-height); min-height: var(--pc-control-height); border-radius: var(--pc-radius-control); }`. This replaces integration.css:29, so every dialog's close is 44px, not only Swim school's per-call-site `[&>button]:min-w-11` classes.
     (b) `.turnfin-app .skip-link { position: fixed; top: 8px; left: 8px; z-index: 300; padding: 0 16px; min-height: var(--pc-control-height); display: inline-flex; align-items: center; border-radius: var(--pc-radius-control); background: var(--pc-primary); color: var(--pc-on-primary); font-weight: 600; transform: translateY(-150%); }` and `.turnfin-app .skip-link:focus { transform: none; }`. These move docs.css:382-395 out of the .turnfin-docs scope. Do not defer this to SYS-14: removing the class without it leaves "Skip to content" visible above every module frame.
   - Set the `@layer base` h2 rule (poolside.css:198) to letter-spacing: 0. The mockups use -0.01em only on the page H1.

3. ModuleShell root becomes 'turnfin-module turnfin-${id} tf-shell'.
   - Docs needs no change: docs/layout.tsx already wraps Shell in .turnfin-docs.
   - Refunds adds a 'turnfin-docs turnfin-refunds' wrapper in refunds/shell.tsx.
   - For the top-bar avatar, add nothing. poolside.css:470-471 already gives the 32px avatar with --pc-primary-soft fill and 12px/600 initials (verified unchanged without docs.css .avatar). Do not add a "sunken" fill.

4. Remove the pageLabel, initialCollapsed and base props, and the sidebar cookies, as stated. Also update src/app/page.tsx: drop `initialCollapsed={home.collapsed}` and the './docs/docs.css' and './docs/integration.css' imports, keeping './workspace/module-workspace.css'. Rename HomeShell's module to "Home".

5-6. As stated: the layout imports, the THEME constants set to 'turnfin-module', and DESIGN.md:141.

Acceptance additions:
- The HR, Rota and Training dialog close is 44x44 at 1280 with a mouse.
- The skip link is off-screen until focused on every module.
- h2 letter-spacing computes 0px outside .turnfin-docs.
- The top-bar avatar computes 32px with fill rgb(233,240,253) in light and rgb(23,40,74) in dark.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Do SYS-01 as briefed, with these changes:

1) src/app/docs/integration.css:
- Delete lines 3-19 and 21. Keep line 2 ('.turnfin-docs {'), line 20 (--reading-size, until DC-02) and the closing brace on line 25.
- Also delete lines 24, 26, 27, 28, 30, 31, 44, 45 and 46.
- Delete line 29 only after its rule has moved into poolside.css (step 2c).
- Keep lines 32-43 and 47-57.

2) src/app/docs/poolside.css:
a) Token block (lines 10-12) on .turnfin-app only. Collapse the duplicate selector at 185-186.
b) Set --ui-radius: var(--pc-radius-card) at line 148. Expected side effects: rounded-ui-sm becomes 9.6px, rounded-ui-xs 8px, Sonner toasts and the module CSS that uses var(--ui-radius) go to 16px.
c) Before removing .turnfin-docs from the shell, move these rules under .turnfin-app in this change. Do not defer them to SYS-14.
- Skip link, moved from docs.css:382-395, :4128 and the print rule at :4182, restyled to v2: .turnfin-app .skip-link { position: fixed; top: 8px; left: 8px; z-index: 300; transform: translateY(-150%); display: inline-flex; align-items: center; min-height: var(--pc-control-height); padding: 0 var(--pc-control-pad); border-radius: var(--pc-radius-control); background: var(--pc-primary); color: var(--pc-on-primary); font-weight: 600; } .turnfin-app .skip-link:focus { transform: none; } and @media print { .turnfin-app .skip-link { display: none; } }
- Dialog and sheet close, from integration.css:29: .turnfin-app :is([data-slot='dialog-close'], [data-slot='sheet-close']) { display: inline-flex; align-items: center; justify-content: center; min-width: var(--pc-control-height); min-height: var(--pc-control-height); border-radius: var(--pc-radius-control); }. Also add data-slot="sheet-close" to the built-in close button in src/components/shadcn/sheet.tsx:80.
- Line 238 (.workspace-preview-toggle[data-active='true']), re-scoped to .turnfin-app.
- The [data-slot='tabs-trigger'] radius from line 353, as .turnfin-app [data-slot='tabs-trigger'] { border-radius: var(--pc-radius-inner); }
- Inside @layer base: .turnfin-app svg { flex-shrink: 0; }, keeping docs.css:155.
- The top-bar avatar needs no move (verified unchanged).
d) Line 196: set h2 letter-spacing to 0, per DESIGN.md:170 'No letter-spacing'.

3) src/components/workspace/module-shell.tsx:57: the root becomes `turnfin-module turnfin-${id} tf-shell`.
- Docs: no change. id="docs" already yields turnfin-docs, and docs/layout.tsx:26 already wraps the shell. Do not add a wrapper in docs/shell.tsx, and never put turnfin-docs on or inside the content div.
- Refunds: src/app/refunds/layout.tsx returns <div className="turnfin-docs"><RefundShell who={who}>{children}</RefundShell></div>, exactly like Docs. turnfin-refunds still comes from the ModuleShell id.

4) Remove the pageLabel, initialCollapsed and base props from ModuleShell. Then:
- Delete the now-unused locals: refunds/shell.tsx:23, core/shell.tsx:34, hr/shell.tsx:16, training/shell.tsx:22, app-nav.tsx:39, and the inline pageLabel in rota/shell.tsx.
- Remove the initialCollapsed prop from CoreShell, HrShell, TrainingShell, RotaShell, RefundShell, docs Shell, HomeShell and AppChrome.
- Remove the cookie reads and the next/headers cookies imports from the seven module layouts.
- In src/lib/home.ts, remove cookies() from the Promise.all, the jar binding and the collapsed field.
- In src/app/page.tsx, stop passing initialCollapsed.
- In home-shell.tsx, change module 'Hub' to 'Home'.

5) Layout imports, as briefed. Also src/app/page.tsx: drop './docs/docs.css' and './docs/integration.css' and keep './workspace/module-workspace.css'.

6) Change the THEME constants in hr/actions.tsx, rota/{absences,actions,activities,bookings,roster,segments}.tsx and training/{manage,certificate}-actions.tsx to 'turnfin-module'. Update DESIGN.md:141.

Acceptance, as briefed, plus:
- 'Skip to content' is invisible until focused, and the frame starts at the same y as today.
- Dialog close is 44x44 at 1280 in HR 'Add note', Training 'New course', Rota 'Add duty', a Swim school dialog and a Docs dialog.
- h2 letter-spacing is 0 outside Docs.
- Docs and Refunds change only in pill buttons, 600-weight badges and the 24px H1 and figures below 768px.
- npm run typecheck and npm run lint pass.

## Acceptance
As alex, check /, /swim-school, /students, /students/<id>, /courses/<id>/class, /refunds, /refunds/<submitted id>, /docs, /docs/library, /training, /training/courses (New course dialog), /hr/people/sbx_ava (Add note dialog), /rota (Add duty dialog), /core, /staff and /account at 375 dark, 768 light, 1024 dark and 1280 light. Every shared Button and dialog button computes border-radius 999px. Every badge is font-weight 600. The H1 inside the frame is 24px/30px at 375 and 28px/36px at 1280. h2 letter-spacing is 0 outside Docs. The course switch renders as a track. HR, Rota and Training dialogs match the Swim school dialogs. Docs and Refunds layouts and the top-bar avatar are unchanged. npm run typecheck and npm run lint pass.

## Verification notes
- KEEP: The problem is real today. I checked it in the live sandbox as alex, then applied the proposed change to the page's loaded CSS in the browser (no repo edits) and measured before and after.

What the live app does now:
- ModuleShell's root (module-shell.tsx:57) has the class "turnfin-docs turnfin-module turnfin-<id> tf-shell" on Home, Swim school, Core, HR, Rota, Training, Refunds and Docs.
- Every shared Button in the frame computes a 12px radius on /, /swim-school, /students, /courses/<id>/class, /account, /training/courses, /rota, /hr/people/sbx_ava and /refunds/<submitted id>. On the same pages, collapsible triggers and dialog buttons are 999px. The V2System mockup's .btn is border-radius:999px.
- Badges compute weight 500. The mockup's .tag is 600.
- The H1 is 28px/36px at 375 on every module page, so the phone step-down never applies.
- h2 letter-spacing is -0.5px from legacy docs.css.
- The Training "New course" switch is a 44x44 grey circle (screenshot pair: shots/audit2/sys01/training_courses-1280-light-dlg-pair.png).
- The HR, Rota and Training portals carry "turnfin-docs turnfin-module".
- The ignored props (pageLabel, initialCollapsed, base), the sidebar-cookie reads, the duplicated '.turnfin-app,.turnfin-app' at poolside.css:185-186, and --ui-radius: 0.75rem at :148 all exist as described.

What the simulation gives:
- Every Button becomes 999px and badges become 600.
- The H1 is 24px/30px at 375, and Docs now gets the step-down too.
- The switch renders as a 32x18 track. That is fine: it sits in a 44px labelled row (ui/switch.tsx, min-h-11, Label htmlFor).
- The Refunds next-action panel shows its 2px blue edge, as DESIGN.md requires.

The direction matches DESIGN.md's "Shape" and "Controls" rules and the mockups.

Gaps that would break the change as written:
1. Skip link. The only .skip-link rules are :where(.turnfin-docs) rules in docs.css:382-395. Once the class leaves the shell, "Skip to content" shows as static text above the frame on every non-Docs page. Evidence: home375-pair.png, ss-pair.png, account-pair.png, refund-pair.png. It cannot wait for SYS-14.
2. Dialog close. Deleting integration.css:29 with nothing to replace it drops the FormDialog close button in HR "Add note", Rota "Add duty" and Training "New course" from 44x44 to 16x16 on desktop. shadcn.css:241-250 only sizes it under max-width:48rem or pointer:coarse. Swim school dialogs only get 44px from per-call-site classes (add-swimmer.tsx:41).
3. Wrong line range. integration.css line 2 is the '.turnfin-docs {' selector, so "delete lines 2-19" breaks the block. It must be 3-19.
4. Missing file. src/app/page.tsx is not in the list. It imports docs.css and integration.css and passes initialCollapsed={home.collapsed}, so removing 'collapsed' from lib/home.ts fails typecheck.
5. h2 acceptance. After the change, h2 computes -0.18px because poolside.css:198 sets letter-spacing: -0.01em. The mockups use -0.01em only on the page H1 (.page), and DESIGN.md says no letter-spacing. The "h2 is 0" acceptance check fails unless that line changes.
6. Avatar. It is not "sunken fill, 12px/600". Live, the fallback paints --pc-primary-soft with --pc-primary-ink initials at 12px/600 and 32px. It stays identical without the docs.css .avatar rule, because poolside.css:470-471 and AvatarFallback cover it. Nothing needs moving, and adding a sunken fill would change it.
7. Docs needs no new wrapper. docs/layout.tsx already wraps Shell in <div className="turnfin-docs">. Only Refunds needs one.
- KEEP: The direction is right, and I checked it live. I simulated the change in the sandbox: dropped .turnfin-docs from ModuleShell and the portal classes, deleted the listed integration.css rules and moved the token block to .turnfin-app. I ran it on /, /swim-school, /students, /students/<id>, /courses/<id>(/class), /training(/courses), /hr/people/sbx_ava, /rota, /core, /staff(/sbx_ava), /account, /docs, /docs/documents/<id>/edit and both refunds at 375, 768 and 1280, light and dark. Buttons become 999px pills. Badges go 500 to 600. H1 and figures step down to 24px/30px at 375. The course switch becomes a 32x18 track. No horizontal overflow appeared anywhere. The Docs editor toolbar stays 44x44. Labels that switch from column to row hold one visible item, so nothing moves. The top-bar avatar looks the same: AvatarFallback has its own bg-ui-brand-soft, and poolside.css:470-471 sets the size and type. Only the invisible outer span loses its fill, so the avatar needs no move and the brief's 'sunken fill' description is wrong.

As written, the change breaks five things:
1. Skip link. Its only rule is docs.css:382-395 (and :4128 / print :4182), under :where(.turnfin-docs). With the class gone, 'Skip to content' becomes a permanent static text link above the frame on every non-Docs/Refunds page, pushing the frame down 20px. Verified on /swim-school, /hr/people/sbx_ava, /core and /account; evidence in scratchpad/shots/audit2/sys01/cmp-hr-dialog-1280.png. Deferring it to SYS-14 ships a visible regression if SYS-01 lands alone.
2. Dialog close target. Deleting integration.css:29 and :44 without moving them shrinks the close button from 44x44 to 16x16 at 1280. Measured on HR 'Add note', Training 'New course' and Rota 'Add duty'. The same applies to Docs and Refunds dialogs (portalClassName turnfin-docs) and the Rota roster Sheet. shadcn.css:241-250 only restores 44px at 768px and below or on coarse pointers, and the Sheet's built-in close (shadcn/sheet.tsx:80) has no data-slot, so not even that rule reaches it. Swim school dialogs already have this 16px defect, so 'match the Swim school dialogs' means matching a defect.
3. Wrong line numbers. integration.css line 2 is the '.turnfin-docs {' selector. 'Delete lines 2-19' orphans lines 20-25, and the parser then swallows the next surviving rule (line 32).
4. Typecheck and lint. src/app/page.tsx is missing from the file list. It passes initialCollapsed={home.collapsed}, which no longer exists, and it still imports docs.css and integration.css. The pageLabel locals (refunds/shell.tsx:23, core/shell.tsx:34, hr/shell.tsx:16, training/shell.tsx:22, app-nav.tsx:39) and the cookies imports become unused.
5. Wrong wrapper. Docs and Refunds getting .turnfin-docs 'through their own content wrapper' would break Docs. If the class sits on or inside the content div, these stop matching: :where(.turnfin-docs) .page-content (docs.css:642 and others) and .turnfin-docs .workspace-page-content padding (poolside.css:244, :413). Docs needs nothing: id="docs" already makes turnfin-${id} equal turnfin-docs, and docs/layout.tsx:26 already wraps it. Refunds should get the same outer wrapper.

Acceptance errors: h2 letter-spacing becomes -0.18px (-0.01em, poolside.css:196 @layer base), not 0. DESIGN.md:170 says 'No letter-spacing'. Docs and Refunds also change on purpose (pills, 600 badges, 24px H1 and figures on phones). --ui-radius set to 16px also moves rounded-ui-sm from 7.2 to 9.6px and rounded-ui-xs from 6 to 8px (shadcn.css:86-87: menu, select and command items, close buttons), and Sonner toasts plus the swimmer-profile, class-browser, student-directory and calendar module CSS from 12 to 16px.

Minor: the dev-only 'View as' active tint (poolside.css:238) and the line-tab pill radius (poolside.css:353, swimmer profile focus ring) only reach .turnfin-docs. The svg flex-shrink:0 rule (docs.css:155) leaves 38 icons on /swim-school with no visible change today. All five problems are fixable by amending the change, so it is not refuted.