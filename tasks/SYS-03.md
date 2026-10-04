# SYS-03 — One brand: Turnfin tab titles, the fin as favicon, v2 browser chrome
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- public/brand/app-logo.png
- scripts/docs-preview/server.mjs
- scripts/help-screenshots/build.mjs
- scripts/help-screenshots/fixture.jsx
- scripts/instructor-swimmer-preview/build.mjs
- scripts/refunds-preview/serve.mjs
- src/app/(activities)/analytics/instructors/page.tsx
- src/app/(activities)/assessments/page.tsx
- src/app/(activities)/courses/[id]/class/page.tsx
- src/app/(activities)/courses/[id]/page.tsx
- src/app/(activities)/programmes/[id]/page.tsx
- src/app/(activities)/students/[id]/page.tsx
- src/app/(activities)/swim-school/page.tsx
- src/app/(core)/core/page.tsx
- src/app/(core)/layout.tsx
- src/app/(core)/staff/[id]/page.tsx
- src/app/(help)/help/[[...path]]/page.tsx
- src/app/(help)/help/layout.tsx
- src/app/(instructor)/instructor/classes/[id]/overview/page.tsx
- src/app/(instructor)/instructor/classes/[id]/page.tsx
- src/app/apple-icon.png
- src/app/confirm-password/page.tsx
- src/app/docs/admin/page.tsx
- src/app/docs/documents/[id]/edit/page.tsx
- src/app/docs/documents/[id]/history/page.tsx
- src/app/docs/documents/[id]/page.tsx
- src/app/docs/documents/new/page.tsx
- src/app/docs/layout.tsx
- src/app/docs/library/page.tsx
- src/app/docs/page.tsx
- src/app/docs/poolside.css
- src/app/docs/reports/page.tsx
- src/app/docs/work/page.tsx
- src/app/globals.css
- src/app/hr/layout.tsx
- src/app/hr/page.tsx
- src/app/hr/people/[id]/page.tsx
- src/app/icon.png
- src/app/layout.tsx
- src/app/page.tsx
- src/app/refunds/[id]/page.tsx
- src/app/refunds/layout.tsx
- src/app/refunds/new/page.tsx
- src/app/refunds/page.tsx
- src/app/rota/bookings/page.tsx
- src/app/rota/day/page.tsx
- src/app/rota/layout.tsx
- src/app/rota/overview/page.tsx
- src/app/rota/page.tsx
- src/app/rota/today/page.tsx
- src/app/sign-in/page.tsx
- src/app/training/layout.tsx
- src/app/training/page.tsx
- src/app/training/people/[id]/page.tsx
- src/components/app-logo.tsx
- src/components/auth-frame.tsx
- src/components/devices/session-forms.tsx
- src/components/docs/library.tsx
- src/components/ui-kit/app-shell.tsx
- src/lib/app.ts

## Problem
Tab titles mix three brands and six patterns. Examples: 'Swim school · Swimly' (APP_NAME is still 'Swimly'), 'Turnfin Refunds · Swimly' on every Refunds page including request details, 'Turnfin Docs' as an absolute title on every Docs page, 'Admin · Turnfin Core' (the module is called Admin in the UI), 'Week plan · Turnfin Rota', an unbranded 'Help centre', and plain 'Swimly' on the 404 page. Record pages use generic nouns ('Class', 'Person', 'Swimmer journey') while their H1 is the record's name, and /assessments?view=past keeps 'Upcoming assessments'. The root favicon is the retired Swimly calendar (app-logo.png), while some module layouts override it with the fin, so the icon changes between modules. The description covers swim lessons only, and themeColor (#f4f8f9 / #0b161a) is the old teal ground.

## Change (original)
1) Set APP_NAME = 'Turnfin' and keep one root template, '%s · Turnfin' (default 'Turnfin'). Rewrite the root description to cover Turnfin's modules without naming a customer. 2) Use Next's file conventions for the icons: add src/app/icon.png (the fin cropped to its bounding box, 512px square, transparent) and src/app/apple-icon.png (180px on a white tile). Delete every `icons:` entry (root layout, page.tsx, sign-in, and the (core), hr, refunds, rota and training layouts). Point the two scripts' build.mjs at /brand/turnfin.png, then delete public/brand/app-logo.png, and update DESIGN.md:78-81 so the fin is also the browser icon. 3) Module layouts set only a plain title equal to the module name ('Refunds', 'Docs', 'Training', 'HR', 'Rota', 'Admin'); remove their templates and absolute titles. Help's layout title is 'Help centre' and article pages use the article title. 4) Every page title equals its H1: 'Refund requests', 'New refund request', 'Week plan', 'Day plan', 'Today', 'Bookings', the docs pages ('Docs', 'Document library', 'My work', 'Reading reports', 'Administration', 'New document'), plus Swim school, Rota and Admin for the overviews. Record pages use generateMetadata to return the record name: refund number, document title (and 'Edit <title>' / '<title> history'), swimmer name, class name (also on /class and the deck class page), programme name and person name. /assessments returns 'Past assessments' when view=past. Write the apostrophe in 'Confirm it’s you' as ’. 5) Set viewport themeColor to the --pc-canvas pair (#eef2f6 light, #0c1320 dark), because theme-color only shows on phones and tablets, where the frame is the page; note the source token in a comment. 6) Ground: delete the body background in globals.css:28 and give body.turnfin-app background var(--pc-outer) in poolside.css (var(--pc-canvas) below 768px), so overscroll matches the ground.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1, 3, 4 and 6 as written. Amend the rest as follows.

(2) Icons: add src/app/icon.png (the fin cropped to its alpha bounding box, which is (146,53)-(1023,1150) in public/brand/turnfin.png, padded square to 512px, transparent). Add src/app/apple-icon.png (180px, the fin on a white tile). Delete every `icons:` entry: src/app/layout.tsx:26-29, src/app/page.tsx:10, src/app/sign-in/page.tsx:6, and the layouts for (core) :16, hr :19, refunds :16, rota :17 and training :17.

Before deleting public/brand/app-logo.png, retire AppLogo: in src/components/ui-kit/app-shell.tsx:59, replace <AppLogo> with the fin (the same Image markup as src/components/workspace/brand.tsx), then delete src/components/app-logo.tsx. Then change scripts/help-screenshots/build.mjs:32 and scripts/instructor-swimmer-preview/build.mjs:12 to copy public/brand/turnfin.png to brand/turnfin.png. Rewrite DESIGN.md:78-81 to: 'The fin is the brand everywhere, including the browser and home-screen icon (src/app/icon.png, src/app/apple-icon.png).' Drop the AppLogo sentence.

(4) Titles: each title is the page's name, which is its H1 without the working-site suffix.
- Rota: 'Week plan', 'Day plan', 'Today', 'Bookings', 'Rota'.
- Home keeps 'Turnfin'. The help index keeps 'Help centre'. Instructor help keeps 'Instructor help'.
- /hr: 'HR and performance', which equals its H1 (src/app/hr/page.tsx:21). The layout default 'HR' only covers HR pages that set no title of their own.
- /docs/library: title 'Document library', and change the H1 fallback at src/components/docs/library.tsx:77 from 'The document library' to 'Document library' to match the V2Docs mockup.
- Class pages (/courses/[id], /courses/[id]/class, and the deck class page) return the class name only, never the status tag shown in the H1.
- Write the apostrophe in 'Confirm it’s you' as ’ in both the title (src/app/confirm-password/page.tsx:5) and the H1.

(5) themeColor follows the ground from step 6, with four media entries:
- '(prefers-color-scheme: light) and (max-width: 767px)' → #eef2f6
- '(prefers-color-scheme: dark) and (max-width: 767px)' → #0c1320
- '(prefers-color-scheme: light) and (min-width: 768px)' → #f7f9fb
- '(prefers-color-scheme: dark) and (min-width: 768px)' → #070c14
Add a comment naming --pc-canvas and --pc-outer in poolside.css:13-14 as the source.

Acceptance:
- document.title is '<page name> · Turnfin' on every audited route, with the exceptions named above.
- Record pages show the record name: 'RF-000002 · Turnfin', 'Otters · Turnfin', 'Quinn Fictional · Turnfin', 'Ava Example · Turnfin', 'Pool opening procedure · Turnfin', 'Pool opening procedure history · Turnfin'.
- grep finds no 'Swimly' in titles or src/lib/app.ts, and no 'Turnfin (Core|Refunds|Docs|HR|Rota|Training)' in any metadata.
- grep finds no '/brand/app-logo.png' or 'AppLogo' anywhere in src, scripts or DESIGN.md.
- The fin is the only icon link on /, /swim-school, /instructor, /docs, /help, /refunds, /confirm-password and a 404.
- The theme-color metas read #eef2f6 and #0c1320 below 768px, and #f7f9fb and #070c14 from 768px.

Note: the 404 is Next's unstyled default page (black, no frame), because there is no src/app/not-found.tsx. Give it a page built on the existing AuthFrame (the fin on the canvas), titled 'Page not found', with a single 'Go to home' button. A separate system task can own this if one does.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1, 2, 4 and 6 as written, with these amendments:

A) Titles keep one template all the way down. In src/lib/app.ts add `export const TITLE_TEMPLATE = \`%s · ${APP_NAME}\`` with APP_NAME = 'Turnfin'. The root layout uses `title: { default: APP_NAME, template: TITLE_TEMPLATE }`. Any layout that sets a title MUST also set the template, because a plain-string or absolute title in a layout drops ' · Turnfin' from every page under it (Next resolve-title.js). So: (core) `{ default: 'Admin', template: TITLE_TEMPLATE }`, plus refunds 'Refunds', docs 'Docs', training 'Training', hr 'HR', rota 'Rota', and (help)/help/layout.tsx 'Help centre', all in the same shape. Pages use plain strings, and no file under src/app uses `absolute`. sign-in becomes `title: 'Sign in'`, and page.tsx drops its title because the root default is 'Turnfin'. The help [[...path]] generateMetadata returns `article.title` (no ' · Help'), and keeps 'Instructor help' and 'Help centre'.

B) generateMetadata on record pages follows four rules:
(i) Call the page's own guard first: screenPage(...), requireRefundActor(), requireMember(), pageSession() with canSee, and requireFreshSession('hr.records.read', `/hr/people/${id}`) on hr/people/[id].
(ii) Reuse the page's loader through React `cache()` defined at module scope in the page file, for example `const load = cache(getRefund)`, so the page and its metadata share one query per request.
(iii) Catch the errors the page already catches (RefundError, DomainError with code 404, a null record) and return the generic noun; the page still calls notFound(), so 404s stay 404s.
(iv) Take the name from what the H1 shows: the document title from documentView's selected or draft content (never the raw row, so readers never see an unpublished draft title), and courseName(course) from getInstructorClass or classPage for the class pages.
Activities pages use only Activities loaders, with no `club`/`instructor` keys in include or select (the eslint activitiesData rule). Core and Work pages never import @/modules/activities.

C) Children's names stay out of document.title. /students/[id] returns 'Swimmer', not the swimmer's name, because titles persist in browser history on shared reception and poolside devices. Staff names, class names, refund numbers and document titles are fine.

D) Retiring app-logo.png: point src/components/app-logo.tsx at /brand/turnfin.png, or delete AppLogo and its use in src/components/ui-kit/app-shell.tsx, so the preview fixtures that render AppShell keep a logo once the two build.mjs scripts copy turnfin.png. Then delete public/brand/app-logo.png and rewrite DESIGN.md:78-81 so it says the fin is the only brand mark, browser icon included. After the change, `grep -rn "icons:" src/app` must return nothing; one leftover entry would turn off the file icon on that route.

E) themeColor follows the ground at each width, the same rule as the body in step 6. Use generateViewport or the static viewport with four entries: `(prefers-color-scheme: light) and (max-width: 767px)` #eef2f6, `(prefers-color-scheme: light)` #f7f9fb, `(prefers-color-scheme: dark) and (max-width: 767px)` #0c1320, `(prefers-color-scheme: dark)` #070c14. Comment the source tokens (--pc-canvas below 768px, --pc-outer above). Desktop Safari tints its tab bar with theme-color too, and the frame has an outer ground from 768px up.

F) Do not global-replace 'Turnfin Refunds' or 'Turnfin Docs'. The aria-labels 'Turnfin Refunds overview' and 'Turnfin Docs overview' are CSS selectors (src/app/refunds/refunds.css:5, src/app/docs/docs.css:5746), and the refunds email From name is in src/lib/refunds/notifications.ts:58. Only metadata titles change. The preview-script tab strings may become 'Refunds preview' and 'Docs preview': scripts/refunds-preview/serve.mjs:17, scripts/docs-preview/server.mjs:20.

Acceptance as written, plus: /help/add-swimmer reads 'Add a new swimmer · Turnfin'; /refunds/does-not-exist still returns a 404, not the error boundary; /students/<id> reads 'Swimmer · Turnfin'.

## Acceptance
document.title is '<H1> · Turnfin' on all 68 audited routes; record pages show the record name (for example 'RF-000002 · Turnfin', 'Otters · Turnfin', 'Ava Example · Turnfin'). grep finds no 'Swimly' and no 'Turnfin Core|Refunds|Docs|HR|Rota|Training' in titles or src/lib/app.ts. The fin is the tab icon on /, /swim-school, /instructor, /docs, /help, /refunds, /confirm-password and a 404. The theme-color meta reads #eef2f6 and #0c1320.

## Verification notes
- KEEP: The problem is real. I checked it in the code and in the live sandbox. I used a CDP probe (scratchpad/sys03-titles.mjs) that reads document.title, the icon links, theme-color and the H1 on 33 routes as alex.

Titles:
- '/swim-school' reads 'Swim school · Swimly'. src/lib/app.ts:2 still sets APP_NAME = "Swimly".
- '/refunds', '/refunds/new' and RF-000002 all read 'Turnfin Refunds · Swimly' (refunds/layout.tsx:16).
- Every /docs route reads 'Turnfin Docs', including the document and its history (docs/layout.tsx:13, which uses absolute).
- '/core' reads 'Admin · Turnfin Core' and '/staff/sbx_ava' reads 'Person · Turnfin Core'.
- '/rota' reads 'Week plan · Turnfin Rota', and '/rota/overview' reads 'Turnfin Rota'.
- '/hr' reads 'Turnfin HR' and '/training' reads 'Turnfin Training'.
- '/help' reads 'Help centre', with no brand.
- Record pages use generic nouns: 'Class · Swimly' where the H1 is 'Otters', 'Swimmer journey · Swimly' where the H1 is 'Quinn Fictional', 'Programme · Swimly', 'Training record · Turnfin Training', 'HR record · Turnfin HR'.
- '/assessments?view=past' reads 'Upcoming assessments · Swimly' while the H1 says 'Past assessments'.
- '/confirm-password' reads "Confirm it's you · Swimly". The approved AUConfirm mockup H1 uses ’.
- The 404 page reads 'Swimly'.

Icons:
- The root layout (layout.tsx:26-29) serves /brand/app-logo.png. That icon shows on /swim-school, /instructor, /docs, /help, the record pages, /confirm-password and the 404.
- The fin (/brand/turnfin.png) shows only where a layout or page overrides it: /, sign-in, (core), hr, refunds, rota and training. So the tab icon really does change between modules.
- There is no src/app/icon.png or apple-icon.png yet.

Theme colour and ground:
- theme-color reads #f4f8f9 and #0b161a on every route, which is the old teal ground.
- The body background computes to rgb(255,255,255), from globals.css:28 via --ui-background → --pc-surface. The v2 ground is --pc-outer, which matches both poolside.css:13/446 and the V2Home mockup's '.tf{background:var(--outer)}'. Below 768px the frame drops its padding and fills with --pc-canvas (poolside.css:509-511). So step 6 matches the direction.

Direction check: the mockups have no <title> or favicon, so nothing contradicts the change. DESIGN.md:78-81 calls the fin 'the brand everywhere' but keeps app-logo for browser icons, which is the inconsistency this task removes. Screenshots: shots/audit2/sys03/this_does_not_exist-1280-dark.png and swim_school-375-dark.png.

Four corrections are needed (see amendedChange):
1. AppLogo needs fixing before app-logo.png can be deleted. src/components/app-logo.tsx:8 hard-codes /brand/app-logo.png, and AppShell renders it (src/components/ui-kit/app-shell.tsx:59). That shell is imported by scripts/help-screenshots/fixture.jsx:8. Changing build.mjs alone would leave that fixture with a broken image. The instructor preview fixture already uses InstructorShell, which shows the fin, so its copy is simply stale.
2. The themeColor rationale is wrong for tablets. From 768px to 1099px, .tf-shell keeps 24px of --pc-outer ground above the frame (poolside.css:446; padding only drops to 0 below 768px). The canvas pair would mismatch there. theme-color should follow the same ground rule as step 6.
3. The acceptance rule 'document.title = <H1> · Turnfin' conflicts with live H1s:
   - Rota H1s carry the site, e.g. 'Week plan: LeisureWorld Bishopstown'.
   - The home H1 is the role name ('Management') and its title is 'Turnfin'.
   - The /help H1 is 'What would you like to do?'.
   - The /hr H1 is 'HR and performance'.
   - The /docs/library H1 is 'The document library' (src/components/docs/library.tsx:77), while the V2Docs mockup says 'Document library'.
   - The /courses/[id]/class H1 contains a status tag, so its textContent reads 'OttersCovered'.
4. There is no src/app/not-found.tsx. The 404 is Next's unstyled default page on black, so a title and favicon alone won't make it on-brand.
- KEEP: The change is sound and fixes real problems. I confirmed these live on localhost:3100: /refunds/<id> is titled 'Turnfin Refunds · Swimly' with H1 RF-000002, /docs/library is 'Turnfin Docs', /students/<id> is 'Swimmer journey · Swimly', the root icon is /brand/app-logo.png while refunds, rota and training use the fin, the theme-color meta is #f4f8f9 / #0b161a, and body is rgb(255,255,255). Five parts of it, as written, would cause regressions:

(1) Step 3 breaks its own acceptance test. In Next 16.3.2, a plain-string title in a layout throws away the template for every page under it. node_modules/next/dist/lib/metadata/resolvers/resolve-title.js returns template:null for a string or absolute title, and resolve-metadata.js:805 resets titleTemplates after each layout. You can see this live today: help/layout.tsx has title "Help centre", and /help/add-swimmer is titled 'Add a new swimmer · Help' with no brand suffix. So with module layouts set to 'Refunds', 'Docs' and so on, every page under them would read 'Refund requests' with no ' · Turnfin'.

(2) generateMetadata on record pages can turn a 404 into an error page and can leak names. getRefund (src/lib/refunds/data.ts:43) throws RefundError through guardRead, and documentView throws DomainError. The pages catch these and call notFound(); a bare generateMetadata would not, so /refunds/does-not-exist (a 404 today) would land on refunds/error.tsx. The guards also live in the page bodies: screenPage, requireRefundActor, requireMember, and requireFreshSession('hr.records.read') on hr/people/[id]. A metadata loader that skips them could put names in titles for users who are not allowed to see them, and it would query the database twice.

(3) Children's names in tab titles persist in browser history. Titles stay there and in tab restore on shared reception computers and poolside tablets (SharedDeviceIdle in src/app/layout.tsx), and the idle sign-out cannot clear that. Today the history only holds 'Swimmer journey'.

(4) Deleting public/brand/app-logo.png leaves a broken image. src/components/app-logo.tsx:8 still uses it, and AppShell (src/components/ui-kit/app-shell.tsx:59) renders that logo in six preview fixtures, including scripts/help-screenshots/fixture.jsx. Repointing build.mjs alone would produce broken images there. Also, the static icon file is ignored on any route where a layout or page still sets `icons` (resolve-metadata.js only applies file icons when resolvedMetadata.icons is unset), so every `icons:` entry has to go.

(5) The themeColor reasoning is inaccurate. Desktop Safari also tints its tab bar from theme-color, and from 768px up the visible ground is --pc-outer (.tf-shell has 24px padding, poolside.css:446), not the canvas.

No tests assert titles. Grep shows APP_NAME is used only in the root layout, there is no middleware that would block /icon.png, and lint boundaries are fine as long as each page's generateMetadata uses its own module's loaders. Every issue above can be fixed by amending the change.