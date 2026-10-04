# SYS-13 — States: one empty, loading, not-found, no-access and error pattern
Severity: high | Scope: system

## Files (expected)
- src/app/(activities)/analytics/error.tsx
- src/app/(activities)/analytics/loading.tsx
- src/app/(activities)/courses/loading.tsx
- src/app/(activities)/error.tsx
- src/app/(activities)/loading.tsx
- src/app/(activities)/not-found.tsx
- src/app/(activities)/schedule/error.tsx
- src/app/(activities)/schedule/loading.tsx
- src/app/(activities)/students/[id]/loading.tsx
- src/app/(activities)/students/loading.tsx
- src/app/(core)/error.tsx
- src/app/(core)/loading.tsx
- src/app/(core)/not-found.tsx
- src/app/(help)/help/[[...path]]/page.tsx
- src/app/(help)/help/layout.tsx
- src/app/(help)/help/not-found.tsx
- src/app/(instructor)/instructor/error.tsx
- src/app/(instructor)/instructor/loading.tsx
- src/app/(instructor)/instructor/not-found.tsx
- src/app/docs/docs.css
- src/app/docs/documents/[id]/page.tsx
- src/app/docs/error.tsx
- src/app/docs/loading.tsx
- src/app/docs/not-found.tsx
- src/app/docs/poolside.css
- src/app/error.tsx
- src/app/global-error.tsx
- src/app/hr/error.tsx
- src/app/hr/layout.tsx
- src/app/hr/loading.tsx
- src/app/hr/not-found.tsx
- src/app/loading.tsx
- src/app/not-found.tsx
- src/app/refunds/[id]/not-found.tsx
- src/app/refunds/[id]/page.tsx
- src/app/refunds/error.tsx
- src/app/refunds/loading.tsx
- src/app/refunds/not-found.tsx
- src/app/refunds/refunds.css
- src/app/rota/error.tsx
- src/app/rota/layout.tsx
- src/app/rota/loading.tsx
- src/app/rota/not-found.tsx
- src/app/shadcn.css
- src/app/training/certificates/page.tsx
- src/app/training/error.tsx
- src/app/training/layout.tsx
- src/app/training/loading.tsx
- src/app/training/not-found.tsx
- src/app/training/sign-off/page.tsx
- src/app/workspace/module-workspace.css
- src/components/auth-frame.tsx
- src/components/docs/ui.tsx
- src/components/hr/shell.tsx
- src/components/refunds/queue.tsx
- src/components/shadcn/empty.tsx
- src/components/shadcn/sidebar.tsx
- src/components/shadcn/skeleton.tsx
- src/components/training/shell.tsx
- src/components/ui-kit/app-icon.tsx
- src/components/ui-kit/empty-state.tsx
- src/components/ui-kit/notice.tsx
- src/components/ui-kit/page-header.tsx
- src/components/ui-kit/page-loading.tsx
- src/components/ui-kit/page-state.tsx
- src/lib/app.ts
- src/lib/docs/auth.test.ts
- src/lib/docs/auth.ts
- src/lib/home.ts
- src/lib/page-guards.ts
- src/modules/activities/components/analytics/instructor-report.tsx
- src/modules/activities/components/analytics/reception-report.tsx
- src/modules/activities/components/courses/class-browser.tsx
- src/modules/activities/components/parents/parent-accounts.tsx
- src/modules/activities/components/students/swimmer-browser.tsx
- src/modules/activities/components/today/calendar.tsx

## Problem
There is no root not-found, error or global-error. Every unknown URL, missing record or refused module shows Next's bare '404 | This page could not be found.', in default type on white (pure black in dark), with no frame, no fin and no way back. Inside Swim school and Admin the same default text sits in the canvas. Maya opening /hr or /training/certificates gets that 404 because the layouts call notFound() for 'no access'. Only four error boundaries exist, in three patterns; three call reset(), which Next 16.3 says does not re-fetch, and the deck's says 'Could not load this class' for every deck route. Its not-found says 'Class unavailable' for a missing assessment too. Loading has nine implementations: PageLoading draws bare bars straight on the canvas in a skeleton colour of 1.02-1.04:1 (blank page); there are custom skeletons with literal heights, Docs' legacy .loading-page with its own keyframes and 'Loading your workspace…', and Refunds' text-only loader with a second H1; Home has no loading.tsx. Empty states come in four looks: EmptyMedia a grey 16px square, EmptyTitle 18px/500 at -0.45px, description on 22.75px leading, plus Docs' own EmptyState and the .module-empty and .refund-empty copies.

## Change (original)
1) empty.tsx: the EmptyMedia icon variant uses the .pc-tile-icon look (40px round, --pc-primary-soft and --pc-primary); EmptyTitle 'text-lg font-semibold' with no tracking; description 'text-sm' without /relaxed. empty-state.tsx is the only entry point (props icon, title, hint, action, compact, and 'as' for the heading level). Module tasks migrate .module-empty, .refund-empty and Docs EmptyState onto it. 2) page-loading.tsx: a header skeleton, then a .pc-panel holding .pc-rows of six row skeletons (min-height 64px, --pc-radius-card), with an optional 'tiles' prop for figure pages; token sizes only. In skeleton.tsx and poolside, `.turnfin-app [data-slot='skeleton'] { background: var(--pc-surface-sunken); }` on white panels. Every loading.tsx body in this list becomes <PageLoading /> (tiles for analytics). Add src/app/loading.tsx. Delete the docs.css loading rules (about 2802-2830). 3) Add ui-kit/page-state.tsx with PageNotFound (PageHeader title, EmptyState in a .pc-panel, primary Button 'Go to Home'), NoAccess ('You don’t have access to this page', a hint to ask a manager, Go to Home) and PageError (client; Notice tone error; Button 'Try again' calling the retry prop). src/app/not-found.tsx renders PageNotFound inside an AuthFrame-style canvas. Each module segment's not-found.tsx and error.tsx re-export them so the ModuleShell frame stays. src/app/global-error.tsx has its own <html><body className='turnfin-app'> with the font and poolside.css imports, as the Next docs require. Replace analytics/error.tsx, schedule/error.tsx, instructor/error.tsx and refunds/error.tsx; instructor not-found uses neutral copy ('This page isn’t available', 'Back to classes'). refunds/[id]/not-found.tsx: 'Request unavailable', 'It may be a colleague’s draft or it was removed', 'Back to requests'. lib/docs/auth.ts: 401/403 lead to the Docs not-found ('This document isn’t available', 'Back to the document library'). 4) No access: training/layout.tsx:24, hr/layout.tsx:26, certificates/page.tsx:23 and sign-off/page.tsx:15 render NoAccess inside their shell instead of calling notFound().

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1-3 as written, with these changes.

(a) Drop the NoAccess component.
- Leave notFound() as it is in training/layout.tsx:24, hr/layout.tsx:26, training/certificates/page.tsx:23 and training/sign-off/page.tsx:15. That matches the documented "declines to exist" rule in DESIGN.md and page-guards.ts.
- Make the one PageNotFound state cover both cases, with neutral copy:
  - PageHeader H1 "Page not found".
  - EmptyState in a .pc-panel: icon in the .pc-tile-icon look, title "This page isn't available", hint "It may have moved, or your role doesn't open it. Ask a manager if you need it."
  - Primary Button "Go to Home".
- A notFound() thrown by a layout goes up to the parent segment, because a segment's not-found.tsx renders inside its own layout. So Maya's /hr and /training/* land on the root app/not-found.tsx. A notFound() thrown by a page, such as certificates or sign-off for a Training user without that capability, is caught by training/not-found.tsx inside TrainingShell.
- Acceptance for Maya's routes: the designed not-found state, not a separate no-access state.

(b) In src/app/not-found.tsx, reuse src/components/auth-frame.tsx directly instead of an "AuthFrame-style" copy. Put EmptyState (as="h1") and the Home button in its card. Export metadata title "Page not found". The tab only reads "· Turnfin" once src/lib/app.ts:2 APP_NAME is corrected (separate task).

(c) Skeletons:
- Each PageLoading row skeleton is a real .pc-row: 1px --pc-line border, --pc-radius-card, min-height 64px, inside .pc-panel > .pc-rows.
- Bars inside rows use `.turnfin-app [data-slot='skeleton'] { background: var(--pc-line); }` (1.24:1 light, 1.33:1 dark on white), not --pc-surface-sunken (1.08:1, and also the hover fill). This removes the decorative blue that bg-ui-accent gives today.
- Also add motion-reduce:animate-none in skeleton.tsx.

(d) For empty-state.tsx to really be the only entry point, also move the direct shadcn Empty users onto EmptyState:
- src/modules/activities/components/courses/class-browser.tsx
- src/modules/activities/components/parents/parent-accounts.tsx
- src/modules/activities/components/students/swimmer-browser.tsx
- src/modules/activities/components/today/calendar.tsx

Do this alongside Docs EmptyState (src/components/docs/ui.tsx:93), .module-empty and .refund-empty. Then delete the module-workspace.css:43-44 and refunds.css:46-47 rules.

(e) Leave lib/docs/auth.ts unchanged; line 13 already calls notFound() for 401/403. Only add docs/not-found.tsx re-exporting PageNotFound with the Docs copy ("This document isn't available", "Back to the document library").

(f) When deleting docs.css lines 2802-2830, delete the global @keyframes pulse too. Nothing else uses it, and it currently overrides Tailwind's animate-pulse keyframes.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) Empty states.
- src/components/shadcn/empty.tsx: change the EmptyMedia `icon` variant to `size-10 rounded-full bg-ui-brand-soft text-ui-primary [&_svg:not([class*='size-'])]:size-5`. This gives the .pc-tile-icon look through tokens.
- EmptyTitle becomes `text-lg font-semibold` with no tracking, and keeps rendering a div. parent-accounts.tsx:46 nests an h2 inside it.
- EmptyDescription becomes `text-sm`, without /relaxed.
- src/components/ui-kit/empty-state.tsx is the only entry point. Props: icon, title, hint, action, compact, `as` ('h1' | 'h2' | 'h3', optional; when set, wrap the title in that element inside EmptyTitle; when unset, keep today's div), and KEEP `role?: 'status'` (instructor-report.tsx:56 and reception-report.tsx:54 use it).
- Module tasks migrate .module-empty, .refund-empty, Docs' own EmptyState (components/docs/ui.tsx:108) and the hand-built Empty blocks in swimmer-browser, class-browser, today/calendar and parent-accounts onto it.

2) Loading.
- src/components/ui-kit/page-loading.tsx keeps role="status", aria-busy and the sr-only "Loading". Structure:
  - A header skeleton: two bars.
  - Then `<div className="pc-panel"><ul className="pc-rows">` with six `<li className="pc-row">`, each holding two Skeleton bars. .pc-row already supplies min-height 64px, --pc-radius-card and the --pc-line edge, so no literal row sizes are needed.
  - An optional `tiles` prop adds a `.pc-stats` grid of `.pc-stat` skeletons above the panel.
- src/components/shadcn/skeleton.tsx: change `bg-ui-accent` to `bg-ui-border` (--pc-line: 1.24/1.33:1 on the white panel, 1.10/1.44:1 on the canvas). Add `motion-reduce:animate-none`.
- Do NOT add a `[data-slot='skeleton']` rule to poolside.css. bg-ui-accent already resolves to --pc-surface-sunken, so the rule changes nothing, and an unlayered rule would override callers' utilities.
- Every listed loading.tsx (docs, refunds, instructor, courses, schedule, students, students/[id], and the five that already use PageLoading) becomes `export { PageLoading as default } from '@/components/ui-kit/page-loading'`. analytics/loading.tsx renders `<PageLoading tiles />`. Keep the nested files; do not delete them.
- Do NOT add src/app/loading.tsx. Home keeps no loading state. If one is wanted later, move Home into a (home) route group whose layout renders HomeShell, and put loading.tsx there.
- In src/app/docs/docs.css, delete the .loading-page, .loading-line and .loading-grid rules and the global @keyframes pulse (about lines 2802-2830). Also delete the unused .error-page rules just above them.

3) Page states.
- Add src/components/ui-kit/page-state.tsx with 'use client' at the top, exporting:
  - PageNotFound({ title, hint, href = '/', actionLabel = 'Go to Home' }): PageHeader title, then a .pc-panel holding EmptyState with an icon tile, then a primary Button asChild with Link. Default title: 'This page isn’t available'. Default hint: 'It may have moved, or your role doesn’t include it. Ask your manager if you need it.' Add the icons it needs (e.g. SearchX, AlertCircle) to the ICONS map in ui-kit/app-icon.tsx.
  - PageError({ retry, title = 'Something went wrong', hint = 'Check your connection and try again.' }): Notice tone="error", plus a Button 'Try again' that calls retry().
- src/app/not-found.tsx (server): `export const metadata = { title: 'Page not found' }`. Render AuthFrame with the EmptyState content placed directly in it: as='h1', icon tile, hint, Go to Home. AuthFrame already provides the Card, so no PageHeader or .pc-panel here.
- Add src/app/error.tsx: 'use client', with PageError inside the same AuthFrame canvas. It catches errors from Home and from every module layout.
- src/app/global-error.tsx: 'use client'. It provides its own `<html lang="en" suppressHydrationWarning><body className="turnfin-app">` and imports the four @fontsource weights, './globals.css' and './docs/poolside.css'. No metadata export: render `<title>Something went wrong · Turnfin</title>` instead. Wrap only what PageError needs (no ThemeProvider or TooltipProvider). The theme follows the device.
- Module not-found files are server files: (activities), (core), docs, refunds, training, hr, rota and instructor. Each has `export const metadata = { title: 'Page not found' }` and a default export rendering PageNotFound, so the module frame stays.
  - instructor: 'This page isn’t available' with 'Back to classes' → /instructor.
  - refunds/[id]/not-found.tsx: 'Request unavailable', hint 'It may be a colleague’s draft or it was removed.', 'Back to requests' → /refunds.
  - docs/not-found.tsx: 'This document isn’t available', 'Back to the document library'. It is reached only from page-level notFound() in documents/[id], /edit and /history.
  - (help)/help/not-found.tsx renders the same AuthFrame content as the root not-found, because help has no frame layout.
- Module error.tsx files for (activities), (core), docs, training, hr, rota, refunds and instructor each start with 'use client' and then `export { PageError as default } from '@/components/ui-kit/page-state'`, or wrap it to pass a hint:
  - refunds/error.tsx passes hint 'If you were saving a request, check its history before making another change.'
  - instructor/error.tsx uses the connection hint.
- Delete (activities)/analytics/error.tsx and (activities)/schedule/error.tsx. (activities)/error.tsx sits inside AppChrome and covers them.
- Tab titles will read '· Swimly' at the root and in (activities)/(instructor) until APP_NAME in src/lib/app.ts is fixed by the separate known-issue task. Acceptance depends on that fix.

4) No access: one pattern.
- Do not add NoAccess.
- Do not change training/layout.tsx, hr/layout.tsx, training/certificates/page.tsx, training/sign-off/page.tsx or src/lib/docs/auth.ts. They keep calling notFound(), as page-guards.ts documents.
- Layout-level refusals (training, hr, rota, docs membership, screenPage in refunds and instructor) land on the root not-found canvas. Page-level refusals (certificates, sign-off, /staff, /assessments, /core) land on the module not-found inside the frame. The neutral copy covers both 'missing' and 'not in your role'.

Verify:
- Both themes at 375 and 1280: /does-not-exist, /students/x, /staff/x, /courses/x, /refunds/00000000-0000-0000-0000-000000000000, /docs/documents/x, /hr/people/x, /training/people/x, /instructor/assessments/x.
- As maya: /hr, /training/certificates, /core, /staff, /assessments.
- Signed out: / and /training must still answer 307 to /sign-in, with no skeleton flash.
- Run npm run lint, tsc and node --test src/lib/docs/auth.test.ts.

## Acceptance
/does-not-exist (1280 light, 375 dark), /students/x, /staff/x, /courses/x, /refunds/<zero uuid>, /docs/documents/x, /hr/people/x, /training/people/x, /instructor/assessments/x and maya's /hr, /training/certificates, /core, /staff and /assessments all show a designed v2 state with one H1, an icon tile and a Home or back action, inside the module frame where one applies, in both themes. The tab title is 'Page not found · Turnfin' (or the module equivalent). PageLoading markup rendered with live CSS shows a white panel of visible row skeletons in light and dark. Empty states on /students?q=zzzz, /cancellations, /docs/work and /rota/bookings look identical.

## Verification notes
- KEEP: The problem is real. Most of the change fits the v2 direction, but the "NoAccess" part goes against a documented rule and can't be built as written.

Evidence that the problem is real:
- src/app has no loading.tsx, not-found.tsx, error.tsx or global-error.tsx, and ui-kit/page-state.tsx does not exist.
- Screenshots in shots/audit2/sys13-skeptic/:
  - does_not_exist-1280-light.png shows Next's bare "404 | This page could not be found." on white.
  - does_not_exist-375-dark.png shows the same on pure black.
  - students_x-1280-light.png shows the same default 404 text in the Swim school canvas.
  - The refunds zero-uuid page is a bare 404 with no frame.
  - Maya's hr-1280-light.png and training_certificates-1280-dark.png are bare 404s.
  - instructor_assessments_x-375-light.png says "Class unavailable" for an assessment.
- Error boundaries: analytics/error.tsx, schedule/error.tsx and instructor/error.tsx call reset(). The bundled Next 16.3.2 docs (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md, lines 117-157) say retry() re-fetches and reset() does not. Only refunds/error.tsx uses retry.
- The error UIs use three patterns: Alert destructive, Notice, and plain text. Analytics and schedule also use tracking-tight, which breaks the "No letter-spacing" rule.
- Loading has nine bodies, as claimed. PageLoading has no panel and uses bg-ui-accent, which is --pc-primary-soft, a decorative blue. Measured contrast against the canvas is 1.017:1 in light and 1.27:1 in dark. The task's "1.02-1.04 in both" is true for light only.
- Empty states:
  - EmptyMedia's icon variant is rounded-ui-lg (16px) with bg-ui-muted. The crop-empty.png crop shows a grey square.
  - EmptyTitle is text-lg font-medium tracking-tight, which breaks the 600 weight and no-tracking rules.
  - The description uses text-sm/relaxed (22.75px leading), which breaks "never leading-*".
  - .module-empty (module-workspace.css:43-44) and .refund-empty (refunds.css:46-47) repeat the .pc-tile-icon look by hand.
- docs.css lines 2802-2830 hold the legacy loading rules plus a global @keyframes pulse. That rule overrides Tailwind's animate-pulse keyframes wherever docs.css loads, so deleting it is right.

The proposed EmptyMedia, EmptyTitle, panel and rows, and retry changes match DESIGN.md v2 (type table and weights, lines 156-170; list = .pc-panel with .pc-rows, line 194; icons are the one neutral tile, poolside.css Docs rule).

Where the change is wrong:
1. Point 4, NoAccess:
   - DESIGN.md lines 362-367 and 419-421, and the comment in src/lib/page-guards.ts lines 6-14, say a refused page deliberately "declines to exist". It returns a 404 so it doesn't confirm the page is there.
   - screenPage, permissionPage and anyPermissionPage 404 for every other route. Adding NoAccess in four places gives two looks for the same situation: /hr would say "no access" while /staff says "not found". That adds a concept, which the pillars ask us to avoid.
   - It also can't be built as written. HrShell and TrainingShell need a non-null `who`, and the layout has none when access is refused.
2. Skeleton colour: --pc-surface-sunken on white is 1.083:1 in both themes, which is worse than today's dark value. The rows only show up through their --pc-line outline.
3. "empty-state.tsx is the only entry point" ignores four direct imports of shadcn Empty.
4. lib/docs/auth.ts already calls notFound() for 401/403 at line 13. Only docs/not-found.tsx is missing.
5. The "· Turnfin" tab title depends on APP_NAME = "Swimly" in src/lib/app.ts:2, which is fixed by a separate known task.
- KEEP: The change is sound in intent: the root not-found, error and global-error files are missing, and there are several competing loading and empty patterns. Five parts need amending before it ships.

(1) The new src/app/loading.tsx is a regression. A root loading boundary wraps every route under the root layout, including /sign-in, /switch, /help and every module layout. Effects:
- A frameless skeleton flashes on every cross-module navigation and on the auth pages.
- There is no middleware or proxy, so every auth guard runs after the shell has streamed. pageSession() calls redirect('/sign-in') in src/lib/home.ts:14,50 and in each module layout. notFound() runs in the rota, refunds, instructor and docs layouts. All of these would answer 200 with a client-side meta redirect instead of 307/404. The bundled Next docs say streamed responses return 200.

(2) The skeleton CSS rule does nothing. `.turnfin-app [data-slot='skeleton'] { background: var(--pc-surface-sunken) }` changes no colour, because the skeleton is already that colour: bg-ui-accent → --color-ui-accent → var(--ui-muted) (src/app/shadcn.css:72) → --pc-surface-sunken (poolside.css:117). Measured contrast:
- Sunken fill on the canvas, where the header skeleton sits: 1.04:1 in light, so it stays blank.
- Sunken fill on the white panel: 1.08:1.
- --pc-line instead: 1.24:1 (light) and 1.33:1 (dark) on the panel; 1.10:1 and 1.44:1 on the canvas.
The rule is also unlayered, so it would override any bg utility a caller passes. Separately, analytics/loading.tsx sets motion-reduce:animate-none, which PageLoading would drop.

(3) The No access part cannot be built as written.
- TrainingShell and HrShell need the actor (`who`). That actor is null exactly when the layout refuses access (training/layout.tsx:23-24, hr/layout.tsx:25-26). So "NoAccess inside their shell" cannot work at layout level.
- rota/layout.tsx:23-24 has the same pattern and is missing from the task.
- lib/docs/auth.ts already calls notFound() for 401/403, and src/lib/docs/auth.test.ts:46 pins that. docs/layout.tsx:16 calls requireMember, so that notFound() skips docs/not-found.tsx and lands on the root not-found. A "Back to the document library" link would be a dead end for someone who isn't a member.
- src/lib/page-guards.ts documents a 404 as the deliberate answer for a screen the role lacks. /staff, /assessments and /core already work that way, so adding NoAccess on four routes would create two patterns for one situation. That goes against the pillar "prefer removing a concept".

(4) Next.js constraints:
- error.tsx files must be Client Components. A bare re-export without 'use client' fails the build.
- A metadata export cannot come from a 'use client' module.
- global-error.tsx gets no metadata export, no layout CSS and no theme attribute. Next 16.3 does pass `retry`, so the retry part is correct.
- A module's error.tsx never wraps its own layout. Without a root src/app/error.tsx, errors in a module layout or on Home still show Next's default screen.
- AuthFrame already wraps its children in a Card, so putting PageNotFound's .pc-panel inside it nests a panel in a card.
- (help)/help has no frame layout (HelpFrame is rendered in page.tsx:39), so its not-found would render bare.

(5) Callers that would break:
- parent-accounts.tsx:46 puts an <h2> inside EmptyTitle. Making EmptyTitle itself a heading puts a heading inside a heading.
- instructor-report.tsx:56 and reception-report.tsx:54 pass role="status" to EmptyState. The new prop list drops `role`, which breaks both.
- refunds/error.tsx carries a safety hint ("check its history before making another change"). instructor/error.tsx carries "Check your connection and try again." for poolside tablets. Generic copy loses both.
- The tab title becomes "Page not found · Swimly" because APP_NAME is "Swimly" (src/lib/app.ts:2). That is the separate known issue.

Not regressions:
- The import boundaries are fine. ui-kit is Core, and Activities, Instructor and the Work modules may all import it.
- The docs.css loading rules are only used by docs/loading.tsx. Their global `@keyframes pulse` currently overrides Tailwind's animate-pulse wherever docs.css loads, so deleting them is safe.
- The new EmptyMedia look reaches the direct users of the shadcn Empty primitive as intended: class-browser, swimmer-browser and today/calendar.
- Keep the nested loading.tsx files rather than deleting them. A parent Suspense boundary that has already been shown does not show its fallback again during a transition, so /students → /students/[id] would show no skeleton.