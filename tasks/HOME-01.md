# HOME-01 — Home page and module overviews: right site, honest tiles, real empty states
Severity: high | Scope: module

## Files (expected)
- DESIGN.md
- docs/architecture.md
- eslint.config.mjs
- scripts/sandbox.mts
- src/app/(activities)/swim-school/page.tsx
- src/app/(core)/core/page.tsx
- src/app/docs/poolside.css
- src/app/page.tsx
- src/app/rota/overview/page.tsx
- src/auth.test.ts
- src/auth.ts
- src/components/home/home-parts.tsx
- src/components/home/home-shell.tsx
- src/components/home/home-view.tsx
- src/components/rota/pages.ts
- src/components/rota/shell.tsx
- src/components/workspace/module-overview.tsx
- src/components/workspace/module-shell.tsx
- src/lib/clubs/current.test.ts
- src/lib/clubs/current.ts
- src/lib/docs/home.ts
- src/lib/home-meta.ts
- src/lib/home.test.ts
- src/lib/home.ts
- src/lib/hr/home.ts
- src/lib/people/home.ts
- src/lib/refunds/home.ts
- src/lib/rota/home.ts
- src/lib/staff/session-user.ts
- src/lib/training/data.ts
- src/lib/training/home.ts
- src/modules/activities/components/app-nav.tsx
- src/modules/activities/contributions.ts
- src/modules/activities/lib/nav.ts
- src/modules/contributions.ts
- src/modules/registry.ts
- src/modules/server.ts
- src/types/next-auth.d.ts

## Problem
With no club cookie, everyone is placed at clubs[0], so maya (Churchfield) sees a duty desk with no timeline, queues or quick actions, and ava sees '0 Your classes today'. The home top row has no site picker, search or page bar (V2Home shows tools and Today plus the workspace pages). Today tiles needing attention show a bare 'Needs you' and drop the reason; every tile uses its module icon; labels repeat 'today' and ignore singular ('1 Classes today'). 'On shift today' counts every site under a single-site heading. Some Waiting rows have no caption. Quick actions renders for a lifeguard with no actions, and the Turnfin Me note is not a link. The Next classes list is a dead, unlinked row with an inline minHeight. Modules build 'links' items nothing renders (a trainer's sign-off job never appears). 'All clear' is blue text picked at the call site. On overviews: an empty 'Everything in Swim school' panel (maya); 'Waiting for you' counts tiles from another panel ('2 things need you' over one row); header actions are icon-less, duplicate the frame search and put the primary first; 'Everything in Rota' omits Day plan (hand-written list); descriptions are hard-coded, end in full stops and say 'set-up'; there is no 'Open schedule' aside. At 1024 the home grid leaves a 900px void.

## Change (original)
1) getCurrentClub (lib/clubs/current.ts:24-25) falls back to the person's Works at site (first of User.siteIds) before clubs[0]. 2) HomeShell gets the shared tools fragment exported by app-nav (ClubSwitcher, and WorkspaceSearch when the person has the Swimmers screen), composed in src/app/page.tsx, the composition root. Links: Today (current), then the swim school's Daily work pages when visible; the frame hides a one-link bar. 3) TodayGrid: when attention is set, show Tag(HOME_ITEM_META.attention, label=item.hint ?? 'Needs you') with TriangleAlert. Use ACTION_ICONS[item.icon] ?? module icon for tiles. Labels 'Classes', 'Assessments', 'Your classes', 'On shift', 'Off today', counted with plural(). Remove the unused 'wide' parameter. NeedsSummary 'All clear' becomes Tag(HOME_ITEM_META.clear) (gray, CircleCheck). 4) Waiting rows: add hints ('From the front desk', 'Approved, waiting for payment', 'Sent back to you', 'Uploaded in Turnfin Me') and change the label to 'Staff detail changes to check'. 5) Render the Quick actions Section only when there are actions. Show the Turnfin Me note as its own .pc-note link row, 'Training, reading, shifts and HR, on your phone.'. 6) Delete the Next classes list (home-parts.tsx:98-106, activities/contributions.ts:176). 7) Remove the 'links' kind from sortItems, the HomeItem docs and every registerHomeCard. Practical sign-offs gets a count so it becomes a Waiting row. 8) lib/rota/home.ts: filter 'On shift' to the working site (wording 'at your sites' when it is not one of rotaSites); add an 'Off today' tile for rota.manage (UserX) from the existing absences query. 9) ModuleOverview: when every group is empty, show EmptyState ('Nothing to open at <site>', hint 'Switch site or ask your manager'). NeedsSummary counts only the Waiting items it sits beside. Header actions render their ACTION_ICONS icon, skip any action duplicating a frame tool (search), and put the primary last (SWIM_ACTIONS: Book an assessment, then Add a swimmer). Pass the timeline's 'Open schedule' ghost link as the Today aside. Use .pc-grid instead of the inline 380px. 10) Build the Rota overview groups from rota/shell.tsx's link list (add a description field there) so Day plan appears; delete the hand-written array. Swim school and Rota overview subtitles come from the registry description. 11) HomeView: .pc-grid, with Today and Quick actions stacked in one column beside Waiting below about 1180px of content width and three columns at 1280; no inline gridTemplateColumns.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the brief's steps, with these corrections:

1. **Working site (getCurrentClub, lib/clubs/current.ts:24-25).**
   - Fallback order: operation context, then the cookie, then the first of User.siteIds, then User.primaryClubId, then clubs[0]. primaryClubId is needed for 'every site' people such as ava and liam.
   - Do not call auth() or pageSession inside it, because auth() calls it (src/auth.ts:186).
   - Instead, export the raw NextAuth `auth` (`nextAuth`) from src/auth.ts. Import it lazily inside getCurrentClub, read the user id, and select { siteIds, primaryClubId } in the same memoised call.

2. **Home tools and page bar.**
   - Extract the tools JSX from AppChrome (app-nav.tsx:43-50) into an exported SwimTools. Use it in AppChrome and on home.
   - Compose it in src/app/page.tsx, and add that file to compositionRoots in eslint.config.mjs and to rule 4 in docs/architecture.md. Otherwise `npm run lint` fails.
   - Hide a one-link page bar in module-shell.tsx:64 (`pages.length > 1`).
   - Add one line to DESIGN.md's home paragraph: the home page bar is Today plus the swim school's daily pages, as V2Home shows.
   - Delete 'Find a swimmer' from SWIM_ACTIONS (activities/contributions.ts:97). The frame search replaces it on home and on the overview, which is what V2Home and V2Overview show. Do not add a 'skip duplicate actions' rule.

3. **Overview header.**
   - Do not reorder SWIM_ACTIONS.
   - ModuleOverview renders actions in reverse, so the module's first action (Add a swimmer) is the blue one, placed last, as V2Overview shows.
   - Each button shows its ACTION_ICONS icon. Export ACTION_ICONS from home-parts.

4. **Subtitles.** Do not read the registry description. Keep the call-site strings and only drop the trailing full stop on /swim-school, /rota/overview and /core (src/app/(core)/core/page.tsx:26). They match the mockups word for word.

5. **Waiting copy.** Add the captions as proposed ('From the front desk', 'Approved, waiting for payment', 'Sent back to you', 'Uploaded in Turnfin Me' on Certificates to check). Keep 'Details changes to check' with 'Sent from Turnfin Me', as ADOverview shows.

6. **Grid.** Add one `.pc-grid` rule to poolside.css next to `.pc-stats` and use it in HomeView and ModuleOverview in place of both inline gridTemplateColumns.
   - Switch on a container query at about 1000px content width. That gives three columns at 1280 (content about 1094px).
   - Below that, Waiting goes beside a column holding Today and Quick actions.
   - In `.pc-stats`, a lone tile must not stretch the full panel: cap the tile width or use auto-fill.

7. **Turnfin Me note.** Keep it as the plain `.pc-note` shown in V2Home, with the copy 'Training, reading, shifts and HR, on your phone.'.
   - It stays at the end of Quick actions.
   - When there are no actions, render the note alone, with no 'Quick actions' heading.
   - Making it a link is optional, not required by the mockup.

8. **Everything else** goes ahead as written: tag with the hint and TriangleAlert, ACTION_ICONS for tiles, singular and plural labels, removing 'wide', the gray 'All clear' tag from HOME_ITEM_META, deleting the Next classes list, removing 'links' with a counted 'Practical sign-offs', site-filtered 'On shift' plus 'Off today', the overview EmptyState, a Waiting-only count, the 'Open schedule' aside from the timeline item, and Rota groups built from rota/shell.tsx with a description field.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1-11 as written, except for the changes below. Run `npm run typecheck`, `npm run lint` and `npm test` after.

1) Choosing the working site: no circular calls, and use the person's Main site.
In src/lib/clubs/current.ts, split the work into three parts:
- `liveClubs` (a cached club query);
- `wantedClubId()`, which reads operationContext and then the cookie;
- a pure `pickClub(clubs, wanted, defaultSiteId)`, which returns the wanted club if it is live, else the default site if it is live, else clubs[0].

The default site is the person's Main site (User.primaryClubId) when it is live and either their Works at list is empty or includes it. Otherwise it is the first live id in User.siteIds. Otherwise there is none.

In src/auth.ts:
- Add primaryClubId to ACCOUNT_SELECT in src/lib/staff/session-user.ts.
- Compute defaultSiteId from the loaded account.
- Pick the session's site with `pickClub(await liveClubs(), await wantedClubId(), defaultSiteId)` inside the existing try/catch.
- Put `defaultSiteId` on the session user, and declare it in src/types/next-auth.d.ts.
- auth.ts must never call getCurrentClub() again.

getCurrentClub() returns at once when the wanted club is live. Only then does it fall back to `pickClub(clubs, wanted, (await auth())?.user.defaultSiteId)`.

Tests:
- Update the "@/lib/clubs/current" mock in src/auth.test.ts.
- Add src/lib/clubs/current.test.ts covering: cookie wins; Main site; first Works at site; clubs[0]; a stale cookie.

2) Home top row: go through the existing composition root, with no new lint exception.
- In src/modules/activities/components/app-nav.tsx, export a client `SwimSchoolTools({ screens, club, clubs })`: ClubSwitcher, plus WorkspaceSearch with the current router.push / swimmerLookupHref logic. AppChrome renders it as its `tools`, so there is one definition.
- In src/modules/activities/lib/nav.ts, add `dailyPages(screens)`, returning plain `{ href, label }` for the visible "daily" items.
- Re-export both from src/modules/server.ts. That file is already the composition root, and Core pages may import "@/modules/server".
- In src/app/page.tsx, resolve screens (visibleScreens(permissionsOf(session))) and getCurrentClub() (skip the tools if it throws).
- Pass `tools={<SwimSchoolTools …/>}` when the person has the swim-school module. Otherwise pass `tools={<ClubSwitcher …/>}`. Pass `pages={dailyPages(screens)}`.
- HomeShell builds the links: Today (href "/", active on "/"), then the pages. It passes `links` only when there is at least one page.
- Do NOT change ModuleShell's `pages.length > 0` threshold.
- Make `ModuleLink.icon` optional. PagesMore (module-shell.tsx:135) renders the icon only when one is given, because components cannot be sent from the server page to the client shell.
- Delete the "Find a swimmer" action and the "search" HomeIcon instead of filtering at the call site. Every screen that shows swim-school actions now has the frame search whenever that action would show.

3) TodayGrid:
- Export ACTION_ICONS from home-parts.
- Add `clear: { label: "All clear", color: "gray" }` to HOME_ITEM_META.
- Pick the singular or plural label word without the number, e.g. `count === 1 ? "Class" : "Classes"`. Do not use plural(), which prepends the number that the figure already shows.
- Keep the timeline item's label "Classes today", because it titles the timeline panel.

4) Waiting row captions and the Staff detail label: as written.

5) Turnfin Me note:
- Render it outside the Quick actions panel, so it also shows when there are no actions.
- Make it a link only when a Turnfin Me URL resolves (call staffApiConfig() in try/catch, as src/lib/staff-api/reminders.ts:19 does, from loadHome). Otherwise render the same .pc-note without a link.
- Add `a.pc-note` hover (`--pc-surface-sunken` darkening is not needed; use the a.pc-stat:hover pattern) and inherit colour, with no underline, in poolside.css.

6) Next classes list:
- Also remove `list` from HomeItem (contributions.ts:88-89).
- Update home.test.ts:98-101 to assert only count and hint.

7) Removing the links kind:
- Delete src/lib/hr/home.ts and its import in src/modules/server.ts, because its only item is a link.
- Count practical sign-offs with a new `signoffCount()` in src/lib/training/data.ts. It uses the same where as signoffQueue (extract a where builder) with prisma.trainingAssignment.count, so the home page loads no names.
- Make HomeItem a union where an item without `kind` must have `count`, so nothing is silently dropped again.
- Rewrite home.test.ts:
  - line 81 becomes ["Your class", "Open my classes"];
  - lines 84-87 assert permission filtering through actions and queues (Add a swimmer, Book an assessment, Parent updates) instead of SWIM_LINKS;
  - line 93 finds "Classes";
  - line 95 finds "Assessment".

8) Rota:
- Filter by currentClubId() from lib/clubs/current.
- For "Off today", label the hint "Rostered today and off", because the existing query only sees people with a shift today. Use icon "userX".

9) ModuleOverview:
- Compute the primary (last) button after filtering the actions.
- Use `siteName ?? "this site"` in the empty-state title.

10) Rota pages list:
- Move the list into a new plain module, src/components/rota/pages.ts, with no 'use client'. Export `rotaPages(manage)` with href, label, icon, description and a match rule.
- RotaShell adds `active`. The overview drops the Overview entry.
- Rewrite the registry descriptions for swim-school and rota (registry.ts:103 and 208) as one header line: no roadmap sentence, "setup", and the same punctuation as other page headers. Use them, and Admin's, as the three overview subtitles, so /core is not left hand-written.

11) Layout:
- Add `.pc-grid` to poolside.css under `.turnfin-app`: one column on phones; two columns from 768px (Waiting | Today stacked with Quick actions); three columns at `@media (min-width: 1280px)`. Use a viewport query, because the content box at 1280 is only about 1094px.
- `.pc-grid > :only-child { grid-column: 1 / -1 }`, so a missing column never leaves a void.
- ModuleOverview uses the same class.

Docs: update DESIGN.md "The home page" and "A module's first page" paragraphs, and the HomeItem comment in src/modules/contributions.ts:74-78, to match.

## Acceptance
On / as alex, maya, ava, liam, noah and riley at 375 light and dark, 768 light, 1024 dark and 1280 light and dark: maya and ava land at Churchfield with its timeline and queues; the site picker and search sit in the top row; 'On shift' shows its reason; no 1-plural errors; no empty Quick actions; no void at 1024. On /swim-school (alex, maya), /rota/overview (alex, noah) and /core at 1280 light and 375 dark: an empty state replaces the blank panel; the counts match their panels; Day plan is listed; actions have icons with the primary last.

## Verification notes
- KEEP: The problem is real. I checked the code, the live sandbox and the approved mockups (V2Home at 1280 and 1024, V2Overview, ROOverview, ADOverview). Screenshots are in scratchpad/shots/audit2/home01-skeptic/.

What I confirmed:
- **Wrong site.** current.ts:24-25 falls back to clubs[0], so maya (home-1280-light, home-375-light) and ava (0 'Your classes today') land at LeisureWorld Bishopstown. maya gets no timeline, swim-school queues or desk actions. Her /swim-school shows an empty 'Everything in Swim school' panel.
- **Home top row.** It holds only View as and the account menu. V2Home also has search, the site picker and a page bar.
- **Today tiles.** 'On shift today' shows a bare 'Needs you' (alex, maya, liam). Mockups put the reason in the tag: '1 shift uncovered' (V2Home), '1 shift needs cover' (ROOverview). Every tile uses its module icon: 'Assessments today' shows the pool ladder where V2Home uses a clipboard. '1 Classes today' and '1 Your classes today' show the plural bug.
- **Waiting and Quick actions.** Waiting rows without a caption: Refund requests to decide, Approved refunds to pay, Certificates to check. riley gets an empty Quick actions panel. The Next classes list is a dead row with an inline minHeight (home-parts.tsx:98-106). `sortItems` builds 'links' that nothing renders.
- **All clear.** Its icon is coloured `text-ui-primary` at the call site (home-parts.tsx:54).
- **Rota overview.** It says '2 things need you' above one Waiting row, because the count includes the Today tile (module-overview.tsx:24). 'Everything in Rota' omits Day plan.
- **Overview layout.** Header actions have no icons and include 'Find a swimmer'. There is no 'Open schedule' aside.
- **1024.** alex's home leaves about 430x730px empty beside Quick actions.

Where the brief is wrong or would break something:
1. **ava would not move.** ava has `siteIds: []` and `primaryClubId: club_churchfield` (scripts/sandbox.mts:85,92). 'First of User.siteIds' alone fails the acceptance. Also, auth() calls getCurrentClub (src/auth.ts:144-146,186), so getCurrentClub cannot call auth() or pageSession.
2. **Lint failure.** src/app/page.tsx is not a composition root (eslint.config.mjs:38-42). Importing WorkspaceSearch or visibleNavGroups from Activities fails the notActivities rule. No 'tools fragment' is exported from app-nav today; the tools are inline in AppChrome (app-nav.tsx:43-50). Hiding a one-link bar needs module-shell.tsx:64, which is not in the file list.
3. **'Primary first' is false.** module-overview.tsx:26 already makes the last button primary. The real gap is that V2Overview's primary is 'Add a swimmer'. Reordering SWIM_ACTIONS would also reorder the home Quick actions away from V2Home ('Add a swimmer', then 'Book an assessment').
4. **Registry descriptions would move away from the mockups.** The registry text adds 'bookings', a roadmap sentence ('Camps, pool hire and fitness classes will join it.') and full stops; the rota text differs from ROOverview. The current call-site strings already match V2Overview, ROOverview and ADOverview word for word, except the trailing full stop. 'set-up' is the mockup's own wording.
5. **Rename contradicts ADOverview.** ADOverview shows 'Details changes to check / Sent from Turnfin Me', which is the live wording.
6. **.pc-grid does not exist** in poolside.css. The breakpoint is also inconsistent: content width is about 1094px at 1280 and about 838px at 1024. A rule that stacks below about 1180px would also stack at 1280, which contradicts the three columns V2Home shows there.
7. **Turnfin Me note.** V2Home shows it as a plain note, not a link.

Smaller notes:
- Removing 'links' matches V2Home, V2Overview, ADOverview and the remove-a-concept pillar. ROOverview is the only mockup that draws two link rows; they duplicate 'Everything in Rota'.
- Dropping 'today' from tile labels follows V2Home. V2Overview and ROOverview keep it, but every panel is already titled 'Today at <site>'.
- Extra finding: with no Waiting panel (noah's /rota/overview at 1280), the single 'On shift today' tile stretches about 1046px wide. ROOverview shows a tile about 240px wide.
- KEEP: The change is sound in intent and nothing makes it unfixable, but four parts break things if done exactly as written. I checked each against the code.

(1) Step 1 would hang or loop the session. auth() in src/auth.ts:144-145 and 186 already calls getCurrentClub() to work out which site's permissions apply (sessionUserFor, src/lib/staff/session-user.ts:65). If getCurrentClub then asks auth() for User.siteIds, each waits on the other's memoised promise (React cache) and the request never finishes. Where cache is not active, the two call each other forever. The fallback also misses ava and liam: the sandbox gives them siteIds [] and primaryClubId club_churchfield (scripts/sandbox.mts:84-85). With "first of siteIds" only, ava still lands at clubs[0], so the acceptance check fails.

(2) Step 2 breaks `npm run lint`. src/app/page.tsx is not a composition root. eslint.config.mjs:38-42 lists only src/modules/server.ts, session-hooks.ts and reception-portal.tsx. I piped an import of @/modules/activities/components/app-nav into eslint as both src/app/page.tsx and src/components/home/home-shell.tsx, and both fail no-restricted-imports. Importing @/modules/activities/lib/nav for the Daily work links fails the same way. Lucide icon components also cannot be passed from the server page into the client HomeShell (app-nav.tsx:19-20 says so). And a frame-wide "hide a one-link bar" would remove the page bar, and its screen-reader note "Restricted · every read is logged", for HR users who are not superadmins (src/components/hr/shell.tsx:12-14 gives them one link).

(3) Step 10 cannot import the link list from src/components/rota/shell.tsx. That file is 'use client', so a server page (src/app/rota/overview/page.tsx) gets a client reference, not the array. The list has to move to a plain module.

(4) Steps 3, 6 and 7 fail src/lib/home.test.ts. I ran it: 6/6 pass today. It asserts "Your classes today", "Find a swimmer in your classes", "Cancelled classes" and "Programmes and levels" (these are links-kind items), "Classes today", "Assessments today" and `mine.list` (lines 81, 84-87, 93, 95, 100). With singular labels the fixtures' counts of 1 become "Your class" and "Assessment".

Smaller problems:
- .pc-grid does not exist anywhere (grep finds nothing). HOME_ITEM_META.clear and an exported ACTION_ICONS do not exist yet.
- Step 11's breakpoint contradicts itself. At a 1280 viewport the content box is about 1094px (1280 − 48 shell padding − 2 border − 48 frame padding − 64 rail − 24 gap), so "two columns below about 1180px of content width" can never give three columns at 1280.
- The registry descriptions that steps 9 and 10 would use as subtitles end in full stops, say "set-up" and include a roadmap line ("Camps, pool hire and fitness classes will join it", registry.ts:103). Nothing else in the UI reads them, so editing them is safe.
- A Turnfin Me link has no URL unless STAFF_ME_URL or allowed origins are set (staffApiConfig throws otherwise, staff-api/config.ts:9).
- signoffQueue loads names and notes. The home page should only count (people/home.ts:14).
- "Off today" taken from the existing rota absences query only counts people who had a shift today (rota/home.ts:26-30).
- Removing links-kind items leaves the HR card always empty (hr/home.ts:11).