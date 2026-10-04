# SYS-02 — Delete the retired sidebar shell and dead shared CSS
Severity: medium | Scope: system

## Files (expected)
- DESIGN.md
- docs/architecture.md
- scripts/analytics-preview/fixture.jsx
- scripts/assessment-workspace-preview/fixture.jsx
- scripts/check-assessment-workspace.mjs
- scripts/check-legend-agreements.mjs
- scripts/follow-up-preview/fixture.jsx
- scripts/help-screenshots/build.mjs
- scripts/help-screenshots/fixture.jsx
- scripts/legend-agreements-preview/fixture.jsx
- scripts/move-readiness-preview/fixture.jsx
- src/app/(activities)/layout.tsx
- src/app/(activities)/swim-school.css
- src/app/docs/docs.css
- src/app/docs/integration.css
- src/app/docs/poolside.css
- src/app/layout.tsx
- src/app/motion.css
- src/app/rota/day/page.tsx
- src/app/rota/today/page.tsx
- src/app/shadcn.css
- src/components/app-logo.tsx
- src/components/docs/appearance-menu.tsx
- src/components/rota/roster.tsx
- src/components/rota/segments.tsx
- src/components/shadcn/sidebar.tsx
- src/components/staff/role-preview.tsx
- src/components/ui-kit/app-shell.tsx
- src/components/workspace/account-menu.tsx
- src/components/workspace/module-shell.tsx
- src/components/workspace/your-modules.tsx
- src/hooks/use-mobile.ts
- src/lib/shell-preferences.ts

## Problem
Code from the sidebar era is still shipped and keeps legacy CSS alive. Nothing imports ui-kit/app-shell.tsx (a sidebar shell with its own AccountMenu and 'Back to Hub'), docs/appearance-menu.tsx or app-logo.tsx (used only by AppShell). shadcn/sidebar.tsx serves only that dead code. your-modules.tsx still exports YourModulesNav, HomeButton and HelpButton. poolside.css carries about 130 lines of .workspace-sidebar, .workspace-mobile-sheet, .workspace-topbar, .workspace-breadcrumb, .workspace-nav-*, .app-footer and .workspace-mobile-toolbar rules, a second teal palette (#0a5d80, #3fd9d6) and tokens nothing reads (--brand-sand, --brand-navy, --brand-sky, --sky, --sidebar, --ui-emergency-*). It keeps the --pc-aqua* aliases and --pc-radius-inner, which duplicates --pc-radius-control. shadcn.css:159-219 holds the sidebar and selection rules, and motion.css:58-68 the sidebar icon motion. swim-school.css:4-21 duplicates poolside.css:590/623/630. Comments in role-preview.tsx and layout.tsx:69-71 still describe a sidebar.

## Change (original)
1) Delete ui-kit/app-shell.tsx, shadcn/sidebar.tsx, docs/appearance-menu.tsx and components/app-logo.tsx. Delete YourModulesNav, HomeButton and HelpButton from your-modules.tsx, keeping YourModulesProvider and useYourModules. 2) poolside.css: before deleting each selector, grep its classes in src/**/*.tsx; delete only those with no user. That means the workspace-sidebar and sidebar-palette block (about 205-247 and 250-302), 348-349, 402-405, 412-417, the duplicate .turnfin-workspace rules (206, 430) and .pc-surface-seg (617). KEEP the global focus rule at line 248 (SYS-07 moves it) and the .turnfin-docs page rules Docs still uses. Delete the --brand-sand, --brand-navy, --brand-sky, --sky and --ui-emergency-* tokens, and --sidebar in integration.css. Replace --pc-aqua-soft/--pc-aqua-ink with --pc-primary-soft/--pc-primary-ink at their call sites (rota/day/page.tsx, rota/today/page.tsx) and delete the aliases. Replace every var(--pc-radius-inner) with var(--pc-radius-control) and delete the token. Delete the duplicate `.turnfin-docs .tabular-nums` (203). 3) shadcn.css: delete 159-219 (sidebar, workspace-inset and [data-slot=button][aria-current] selection rules). Keep `.shadcn-workspace a:focus-visible` only if Help or the deck still renders .shadcn-workspace. 4) motion.css: delete 58-68 (sidebar-icon). 5) swim-school.css: delete the rules poolside.css already applies; if nothing is left, delete the file and its import in (activities)/layout.tsx. 6) Update the stale sidebar comments in role-preview.tsx and layout.tsx.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) Delete src/components/ui-kit/app-shell.tsx, src/components/shadcn/sidebar.tsx, src/components/docs/appearance-menu.tsx and src/components/app-logo.tsx. In your-modules.tsx, delete YourModulesNav, HomeButton and HelpButton, plus the imports that only they use (SidebarMenuButton, Button, Link, ArrowLeft, CircleHelp). Keep YourModulesProvider and useYourModules.

2) In account-menu.tsx, remove the unused 'sidebar' variant. Make the bar trigger the only trigger and drop the variant, compact and onNavigate props and ChevronsUpDown. The only caller is ModuleShell:83, so update that call to drop variant="bar".

3) poolside.css. Before deleting each selector, grep its classes in src/**/*.tsx.
- Delete 205-247, except: keep 238 (.workspace-preview-toggle, which RolePreviewToggle in ModuleShell uses) and 243-244 (docs/shell.tsx still uses .workspace-page-content). Lines 228-233 (.workspace-account*) go once step 2 is done.
- Keep the global focus rule at 248 (SYS-07 moves it).
- Delete 250-302, 348-349 and 402-405.
- In 412-417, delete 414-416. Keep 413.
- Delete 206 and 430 (.turnfin-workspace), 213-215 and 300, and 384-385 (.workspace-search has no tsx user).
- At 617, remove only `.turnfin-app .pc-surface-seg .pc-seg` from the selector list. Keep `.turnfin-app :is(.pc-panel, [data-slot='card']) .pc-seg`.
- Delete the duplicate `.turnfin-docs .tabular-nums` at the end of line 203.
- Delete the whole aqua/emergency token chain together with its readers, so no var() points at an undefined token:
  - tokens: --pc-aqua, --pc-aqua-soft, --pc-aqua-ink, --pc-aqua-line, --ui-aqua-soft, --ui-aqua-ink, --ui-emergency-bg, --ui-emergency-ink, --ui-emergency-border, --brand-aqua and --aqua (poolside.css:31-34, 131-135, 155, 172);
  - also --brand-navy, --brand-sky, --brand-sand, --sky (poolside.css:173) and --ui-sidebar/--ui-sidebar-hover (123-124).
- At the call sites in rota/day/page.tsx:26 and rota/today/page.tsx:140, change --pc-aqua-soft and --pc-aqua-ink to --pc-primary-soft and --pc-primary-ink.
- Replace every var(--pc-radius-inner) with var(--pc-radius-control) and delete the token (poolside.css:83). Callers: poolside.css:353 and 367, rota/day/page.tsx, rota/today/page.tsx, components/rota/roster.tsx:97 and 170, components/rota/segments.tsx:66.

4) integration.css: delete --aqua (16), --sky (17) and --sidebar (19).

5) docs.css: delete the declarations that read the removed tokens. They are all dead or overridden by poolside.css:639-640 and :312.
- In .doc-icon.type-eap (4476-4479), delete the declarations that read the removed tokens.
- In .emergency-banner (6207-6210), delete the declarations that read the removed tokens.
- In .template-preview (6529), delete the border-top declaration.
- Delete .emergency-shortcut (4991-5030), .emergency-card (854-857), .auth-story (2588-2603), .sidebar (399-402) and .workspace-main (580-581). Delete each block only after grepping that no tsx file uses it.

6) shadcn.css:
- Delete 159-189: .workspace-inset and the [data-sidebar=sidebar] hover and selection rules.
- Delete 190-197: [data-slot=button][aria-current=page] and the default-variant tabs rule. Both are overridden today (checked on /courses/.../class).
- Delete 204-219: .shadcn-workspace [data-slot=sidebar-*] and [data-mobile][data-slot=sidebar].
- Keep 198-203, the active tabs-trigger colour and ::after primary underline. They give the swimmer profile's line tabs their blue selection. Optionally move them into poolside.css as `.turnfin-app [data-slot='tabs-list'][data-variant='line'] [data-slot='tabs-trigger']::after { background: var(--pc-primary) }`.
- Also delete --ui-sidebar and --ui-sidebar-hover (33-34), the --color-ui-sidebar-* theme entries (78-85) and the [data-slot="sidebar-input"] selectors (107 and 121).
- Keep `.shadcn-workspace a:focus-visible` (108). help-frame.tsx and instructor-shell.tsx still render .shadcn-workspace.

7) motion.css: delete 58-68.

8) swim-school.css:
- Delete line 4. It is dead: the desk's contentClass has no workspace-page-content.
- Delete 7-21 only if a pixel compare of /students, /swim-school and /courses tables, lists and empty states at 1280 light and 375 dark shows no change. These rules add overflow:hidden and also reach item-groups inside cards, which poolside.css:590/623/630 does not.
- If the file ends up empty, delete it and its import at (activities)/layout.tsx:12.

9) Update the sidebar comments in role-preview.tsx:14 and :21 and layout.tsx:70-72 to say the toggle sits in the frame's top bar. Remove app-shell from DESIGN.md:679.

Acceptance:
- grep finds no importer of the deleted files, no tsx use of any deleted class, and no var() of any deleted token.
- A pixel compare at 1280 light and 375 dark shows no change on /, /swim-school, /students, /students/cmutm2a5u000nqkluiz9dhrn2 (the line tabs' active underline stays blue), /courses/cmutm2a5g000eqkluc713evsf/class, /docs (including an EAP document icon and the emergency banner), /refunds, /rota/day and /rota/today.
- npm run typecheck and npm run lint pass.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
0) Fixtures first, before deleting app-shell.tsx.
- In scripts/{help-screenshots,analytics-preview,assessment-workspace-preview,follow-up-preview,legend-agreements-preview,move-readiness-preview}/fixture.jsx, replace each <AppShell …> wrapper with <ModuleShell module="Swim school" id="swim-school" who={{id:'demo',name:'Alex Example'}} links=[…] or groups=[…] scopeNote="Demo site">. For move-readiness, use whatever module the screen belongs to.
- Wrap the root in <div className="turnfin-app">.
- Swap the @fontsource/figtree imports for @fontsource/plus-jakarta-sans.
- Add src/app/docs/poolside.css and src/app/workspace/module-workspace.css to each build's CSS. For help-screenshots that is build.mjs:28-30, which currently compiles only globals.css.
- Update the skip-link assertions in scripts/check-assessment-workspace.mjs:96-98 and scripts/check-legend-agreements.mjs:157-159 from 'workspace-main' to 'swim-school-main'.
- Run each build/check (check-analytics, check-assessment-workspace, check-legend-agreements, move-readiness-preview/build.mjs, follow-up-preview/serve.mjs, help-screenshots buildScreenshots) and confirm they bundle and pass.

1) Delete the dead components.
- Delete src/components/ui-kit/app-shell.tsx, src/components/shadcn/sidebar.tsx, src/components/docs/appearance-menu.tsx and src/components/app-logo.tsx.
- Also delete src/hooks/use-mobile.ts (only sidebar.tsx used it) and NAV_COLLAPSED_COOKIE in src/lib/shell-preferences.ts (only AppShell wrote it). Keep SHELL_PAGE_ID (instructor-shell.tsx) and src/lib/nav-active.ts (activities nav).
- In your-modules.tsx, delete YourModulesNav, HomeButton and HelpButton, and remove their now-unused imports (Link, ArrowLeft, CircleHelp, Button, SidebarMenuButton). Keep 'use client', YourModulesProvider and useYourModules.

2) poolside.css. Grep every class before deleting. Delete only rules whose classes have no tsx user, or whose class is used only by code deleted in step 1.
- Delete: 206 and 430 (.turnfin-workspace); 207-227 and 239-243, 245-247 (workspace-sidebar, brand-row, search, nav-label, nav-item, nav-count, sidebar-footer, appearance-button, profile, topbar, breadcrumb, workspace-page, app-footer, mobile-sheet); 234-236; 250-302 (sidebar teal palette); 348-349; 402-405; 414-416; all of 617; and only the trailing `.turnfin-docs .tabular-nums {…}` on line 203 (keep the eyebrow rule on that line).
- KEEP: 229-233 (.workspace-account, used by account-menu.tsx), 238 (.workspace-preview-toggle, used by role-preview.tsx), 244 and 413 (.workspace-page-content, used by docs/shell.tsx), 248 (focus rule), and all live .turnfin-docs page rules.
- Aliases: in rota/day/page.tsx:26,158 and rota/today/page.tsx:140, replace --pc-aqua-soft/--pc-aqua-ink with --pc-primary-soft/--pc-primary-ink. Then delete together, as one chain:
  - poolside.css:30-35 (the comment, --pc-aqua, --pc-aqua-soft, --pc-aqua-ink, --pc-aqua-line), 131-135 (--ui-aqua-soft/ink, --ui-emergency-bg/ink/border), 153 (--brand-navy), 155 (--brand-aqua), 156 (--brand-sky), 157 (--brand-sand), 172 (--aqua), 173 (--sky).
  - integration.css:16 (--aqua), 17 (--sky), 19 (--sidebar).
  - The docs.css readers of these tokens, all on dead classes or overridden by unlayered poolside.css:315/639/640: 4476-4479 (.doc-icon.type-eap block); the .emergency-shortcut* rule group starting at 4991 (class has no tsx user); only the border/background/color declarations at 6207-6210 inside .emergency-banner (keep its layout declarations); 6529 (template-preview border-top); 857 (.emergency-card border-top-color); 2589 and 2603 (.auth-story); 402 and 581 (width/margin-left: var(--sidebar) on the dead .sidebar/.workspace-main).
- Do NOT delete --ui-sidebar or --ui-sidebar-hover (poolside.css:123-124, shadcn.css:33-34): docs.css:6354 (.task-queues a:hover, live Docs work queues) reads them.
- Radius: replace var(--pc-radius-inner) with var(--pc-radius-control) only under src/: poolside.css:353,367; rota/day/page.tsx; rota/today/page.tsx; src/components/rota/roster.tsx:97,170; src/components/rota/segments.tsx:66. Then delete poolside.css:83. Do NOT touch apps/me (its own --pc-radius-inner is 16px).

3) shadcn.css.
- Delete only 159-188 (.workspace-inset and [data-sidebar="sidebar"] rules) and 204-219 (.shadcn-workspace sidebar-* and [data-mobile][data-slot=sidebar]).
- Inside the coarse-pointer media block, remove only the sidebar selectors: 222-223 [data-sidebar="menu-button"], and the sidebar-trigger/sidebar-menu-button entries at 232-233 and 246-247.
- KEEP 189-203. They style the swimmer profile line tabs and the TabStrip active step. They go away later with the TabStrip-to-SegmentedLinks consolidation, not in this task.
- KEEP `.shadcn-workspace a:focus-visible` (line 108): help-frame.tsx:12 and instructor-shell.tsx:61 still render .shadcn-workspace.

4) motion.css: delete 58-68.

5) swim-school.css is not a pure duplicate.
- Delete line 4 (dead: the swim school never renders .workspace-page-content) and lines 17-21 (empty-state rule, matches poolside.css:630).
- For lines 8-16 (table-container/item-group): delete them, then verify /schedule (sheet view at 1024 and 1280, light and dark). The .sheet-scroll section must now be the horizontal scroller, with the sticky time column still sticking, and no page overflow at 768. Also verify /cancellations and the duty manager page. If any of these differ in a way that hurts, keep only the overflow rules and say why in a comment.
- Delete the file and its import at (activities)/layout.tsx:12 only if nothing is left.

6) Comments and docs.
- Fix the sidebar comments in role-preview.tsx:13-14 and 21-22 ("the frame's tools bar") and layout.tsx:70-72.
- Update DESIGN.md:79-81 (drop `AppLogo`; the PNG stays for icons), DESIGN.md:678-679 (remove app-shell from the ui-kit list) and docs/architecture.md:59 (remove appearance-menu).

Acceptance:
- grep finds no importer of the deleted files and no reader of any deleted token anywhere in src/ or scripts/.
- npm run typecheck and lint pass, and the step-0 fixture builds and checks pass.
- Pixel compare at 1280 light and 375 dark on: /, /swim-school, /students, /students/cmutm2a5u000nqkluiz9dhrn2 (line tabs stay blue), /courses/cmutm2a5g000eqkluc713evsf/class (active step keeps its soft fill), /docs (emergency banner), /docs/new (template preview), /refunds, /rota/day, /rota/today, /rota, /cancellations. Also /schedule as described in step 5.

## Acceptance
grep finds no importer of the deleted files and no tsx use of any deleted class. /, /swim-school, /students, /docs, /refunds and /rota/day at 1280 light and 375 dark look the same as before (pixel compare). npm run typecheck and lint pass.

## Verification notes
- KEEP: The problem is real. Removing it fits DESIGN.md:13, which says the sidebars "describe the retired look", and the pillar of removing concepts. But four parts of the proposed change are wrong and need amending.

What I confirmed in the code:
- Nothing imports ui-kit/app-shell.tsx, docs/appearance-menu.tsx (AppearanceMenu) or app-logo.tsx (AppLogo is used only by app-shell:7). shadcn/sidebar.tsx is imported only by app-shell.tsx and your-modules.tsx:7.
- YourModulesNav and HelpButton have no importers. HomeButton is used only by app-shell:15.
- motion.css:58-68 targets data-motion=sidebar-icon, which only your-modules.tsx sets, and [data-sidebar=menu-button], which only sidebar.tsx sets.
- In poolside.css, these selectors have no tsx user: .workspace-sidebar, .workspace-mobile-sheet, .workspace-mobile-toolbar, .workspace-topbar, .workspace-breadcrumb, .workspace-nav-count, .workspace-navigation, .app-footer, .appearance-button, .workspace-search (app-nav.tsx only has it in an import path), .turnfin-workspace (206 and 430) and .pc-surface-seg.
- The teal palette at 253-302 only styles those dead selectors.
- --brand-navy and --brand-sand are never read.
- --pc-radius-inner and --pc-radius-control are both 999px, so swapping one for the other changes nothing.
- The stale sidebar comments are at role-preview.tsx:14 and :21, and layout.tsx:70-72.
- Screenshots: shots/audit2/sys02/students_cmutm2a5u000nqkluiz9dhrn2-1280-light.png and courses_cmutm2a5g000eqkluc713evsf_class-1280-light.png.

What the proposal gets wrong:

(1) Deleting shadcn.css:159-219 as one block would visibly break a live screen. Lines 198-203 are not sidebar rules:
- `[data-slot="tabs-trigger"][data-state="active"]{color:var(--ui-brand-ink)}`
- `[data-slot="tabs-trigger"]::after{background-color:var(--ui-primary)}`

These rules are outside any layer, so they beat Tailwind's `after:bg-ui-foreground`. That gives the swimmer profile's line tabs (swimmer-profile.tsx:63) their blue selection underline. I tested this in the sandbox by removing the rules in the browser: on /students/cmutm2a5u000nqkluiz9dhrn2 the active tab's ::after went from rgb(29,95,209) to rgb(15,27,45). The blue-for-selection rule says it should stay blue.

Removing `[data-slot=button][aria-current=page]` and the default-variant tabs rule (190-197) is safe. The TabStrip "1. Attendance" step on /courses/.../class kept the same background and colour in both themes after removal, and poolside.css:606 already overrides the default tabs.

(2) "Tokens nothing reads" is false for --ui-emergency-*, and the aqua tokens are a chain, not simple aliases:
- docs.css reads --ui-emergency-*: 4477-4478 (.doc-icon.type-eap, live through docs/ui.tsx:30 for EAP documents) and 6207-6210 (.emergency-banner, live at docs/home.tsx:75; this rule also reads --ui-aqua-soft and --ui-aqua-ink).
- Today these are hidden because docs.css sits in @layer components.legacy and poolside.css:639-640 overrides them. So deleting the tokens leaves no visible change, but it does leave var() calls pointing at undefined tokens.
- --pc-aqua-line has its own light-dark value; it is not an alias. It feeds --ui-emergency-border.
- --pc-aqua feeds --brand-aqua and --aqua (poolside.css:155 and 172, integration.css:16). docs.css reads those at 857, 2589 and 6529.
- integration.css:17 defines --sky from --brand-sky.
- docs.css:399-402 (.sidebar) and 580-581 (.workspace-main) read --sidebar.

(3) The range "about 205-247" includes rules that are still live:
- .workspace-account and .workspace-account-text (229-233), used by account-menu.tsx:30-32
- .workspace-preview-toggle (238), used by role-preview.tsx:38, which ModuleShell:82 renders
- .workspace-page-content (244 and 413), used by docs/shell.tsx:31

The first two are kept alive only by dead code: AccountMenu's 'sidebar' variant is never used, because its one caller, module-shell.tsx:83, passes variant="bar".

(4) Line 617 is a selector list. Only `.pc-surface-seg` is dead; `:is(.pc-panel,[data-slot=card]) .pc-seg` is live.

Smaller points:
- swim-school.css:4 is dead rather than a duplicate. The desk's contentClass is "module-content swim-school-content" (app-nav.tsx:42), with no workspace-page-content.
- swim-school.css:7-21 is close to poolside.css:590/623/630 but not the same. It adds overflow:hidden and also matches item-groups inside cards and dialogs.
- Removing sidebar.tsx also leaves these unused: --ui-sidebar and --ui-sidebar-hover (shadcn.css:33-34, poolside.css:123-124), --color-ui-sidebar-* (shadcn.css:78-85) and [data-slot=sidebar-input] (shadcn.css:107 and 121).
- DESIGN.md:679 still lists app-shell under ui-kit.
- KEEP: The cleanup is worth doing, but several of the task's own claims are wrong. Run as written, it breaks visible UI and tooling.

(1) shadcn.css:159-219 is not all sidebar code. Lines 189-203 are global selection rules that are in use:
- 198-203 give the swimmer profile's line tabs (swimmer-profile.tsx:63, variant="line") their blue active text and blue underline. Screenshot: shots/audit2/sys02/students_cmutm2a5u000nqkluiz9dhrn2-1280-light.png, the "Journey" tab.
- 190-194 `[data-slot=button][aria-current=page]` gives TabStrip's active step its soft-blue fill on /courses/[id]/class (class-session.tsx:218). Screenshot: courses_cmutm2a5g000eqkluc713evsf_class-1280-light.png, "1. Attendance".
- poolside.css:606 overrides only default-variant tabs. Neither page is in the acceptance list, so the pixel compare would miss both.

(2) "Nothing imports app-shell.tsx" is false. Six esbuild fixtures import AppShell:
- scripts/{help-screenshots,analytics-preview,assessment-workspace-preview,follow-up-preview,legend-agreements-preview,move-readiness-preview}/fixture.jsx.
- help-screenshots is the documented Help Centre image pipeline (docs/help-centre.md:77-87).
- check-assessment-workspace.mjs:96-98 and check-legend-agreements.mjs:157-159 assert AppShell's `#workspace-main` skip target.
- tsconfig doesn't include .jsx, so typecheck and lint stay green while every one of these builds breaks.

(3) "Tokens nothing reads" is false:
- --ui-emergency-* is read by docs.css:4477-4478, 4993-4996, 5028 and 6207.
- --ui-aqua-soft/ink (poolside.css:131-132) is read by docs.css:6209-6210.
- --brand-aqua and --aqua (poolside.css:155, 172; integration.css:16) feed docs.css:857, 2589 and 6529.
- integration.css:17 `--sky: var(--brand-sky)` feeds docs.css:2603.
- integration.css:19 --sidebar feeds docs.css:402 and 581.
- I checked each reader. All are either on classes with no tsx user (.emergency-shortcut, .emergency-card, .auth-story, .sidebar, .workspace-main) or overridden by unlayered poolside.css rules: 639 (.doc-icon), 640 (.emergency-banner) and 315 (template-preview border-top-width:0). Deleting is therefore visually safe today, but only if these chains are handled. Deleting the --pc-aqua aliases alone, as written, leaves them dangling.
- --ui-sidebar-hover must stay: the live Docs work queue (work.tsx:164) uses it through docs.css:6354 `.task-queues a:hover`.

(4) "Replace every var(--pc-radius-inner)" must stay inside src/:
- apps/me/src/app/globals.css:38 defines its own --pc-radius-inner: 16px, used at lines 110, 126 and 140. Replacing those would turn Turnfin Me's notices and textareas into pills.
- The task's Files list also misses two src users: src/components/rota/roster.tsx:97,170 and src/components/rota/segments.tsx:66.

(5) poolside.css "205-247" contains rules still in use:
- 229-233 `.workspace-account`, used by account-menu.tsx.
- 238 `.workspace-preview-toggle`, used by role-preview.tsx.
- 244 and 413 `.workspace-page-content`, used by docs/shell.tsx (overridden by 633, but the class is still used).
- 248, the focus rule.
- So the grep guard must decide line by line. A range delete is not safe.
- Line 617 is a selector list. Only the first selector is dead, but the whole rule restates 609's background, so deleting the whole rule is safe.
- Line 203 holds two rules on one line. Remove only the trailing `.turnfin-docs .tabular-nums`.

(6) swim-school.css is not a pure duplicate:
- It loads after poolside.css (from the nested layout), so it wins ties against 591/592.
- It also adds overflow:hidden / overflow-x:auto (unlayered). That overrides calendar.tsx:131's containerClassName="overflow-visible", which makes the inner table container scroll instead of the labelled, focusable .sheet-scroll section.
- Deleting it changes which element scrolls on /schedule (sheet view) and stops clipping on /cancellations and duty item groups. That is probably an improvement, but it is not a no-op.

(7) Lint boundaries are unaffected: the change only deletes imports and adds none.

All of these can be fixed by amending the change, so it should not be refuted.

Out of scope, flagged as a follow-up: the sidebar-era `initialCollapsed` prop and the `turnfin.*.sidebar` cookies in 8 layouts and ModuleShell; AccountMenu's unused 'sidebar' variant; RolePreviewToggle's `side={compact?'right':'top'}`, which opens upward from the top bar.