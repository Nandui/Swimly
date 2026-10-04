# SYS-11 — Shared lists, tables and tiles: fix the poolside parts and the item primitives
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- src/app/(activities)/programmes/[id]/page.tsx
- src/app/(core)/account/page.tsx
- src/app/(core)/clubs/page.tsx
- src/app/(core)/staff/[id]/page.tsx
- src/app/(core)/staff/devices/page.tsx
- src/app/(core)/staff/organisation/page.tsx
- src/app/docs/poolside.css
- src/app/refunds/refunds.css
- src/components/help/help-frame.tsx
- src/components/home/home-view.tsx
- src/components/shadcn/item.tsx
- src/components/shadcn/table.tsx
- src/components/workspace/module-overview.tsx
- src/components/workspace/module-shell.tsx
- src/modules/activities/components/analytics/dashboard.tsx
- src/modules/activities/components/analytics/instructor-report.tsx
- src/modules/activities/components/analytics/reception-report.tsx
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/duty/billing-list.tsx
- src/modules/activities/components/instructor/instructor-shell.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/together/combination-list.tsx

## Problem
Several shared v2 parts misbehave. Item rows wrapped in role=listitem get no hover because poolside.css:626's selector can never match (an anchor cannot be a direct child of both item-group and listitem). Body-row header cells (<TableHead scope='row'> on analytics) are skipped by the row-card rules, so the first column floats outside the rounded row. .pc-stats uses auto-fit, so a single tile stretches across a 1046px panel. There is no shared 'open filter' state for .pc-stat, so Refunds and Docs invent two. Home and the overviews use different inline grid minimums (320 and 380). The yellow do-first row has no hover. Page blocks sit 16, 24 or 32px apart depending on the module. ItemTitle is 500 and ItemDescription is 14px with line-clamp-2, while the sheet's row is a 600 name over a 12px caption. DESIGN.md:198 describes 'borderless white tiles', contradicting the V2System .stat (16px, 1px line), which .pc-stat already implements.

## Change (original)
1) Split poolside.css:626 into `.turnfin-app .tf-main [data-slot='item-group'] > a[data-slot='item']:hover, .turnfin-app .tf-main [data-slot='item-group'] > [role='listitem'] > a[data-slot='item']:hover { background: var(--pc-surface-sunken); }`. 2) Rows 597-600: apply the body-cell rules to :is([data-slot='table-cell'], [data-slot='table-head']) inside [data-slot='table-body'], with body size, ink, and 600 for the row header. 3) .pc-stats: grid-template-columns repeat(auto-fill, minmax(min(100%, 160px), 1fr)). a.pc-stat[aria-current] gets box-shadow inset 0 0 0 2px var(--pc-primary). 4) Add .pc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start; } for home and overview panels. 5) Add a --pc-yellow-hover token (keeping 4.5:1 for --pc-on-yellow) and use it on a.pc-row[data-first]:hover. 6) `.turnfin-app .tf-main > .module-content { display: flex; flex-direction: column; gap: 16px; }`; module tasks remove their gap-6/space-y-6 wrappers and margin rules. 7) item.tsx:124 ItemTitle font-semibold without leading-snug; item.tsx:137 ItemDescription text-xs muted, no line-clamp; table.tsx: remove font-medium. 8) DESIGN.md:198-199: summary tiles are .pc-stat (16px tile with a 1px line, figure at the bottom); a tile that filters shows a soft fill on hover and a 2px blue edge when open (aria-current). Add a Layout line: tables that would hide columns on phones render .pc-rows below 768px instead.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) Keep as proposed. Split poolside.css:626 into `.turnfin-app .tf-main [data-slot='item-group'] > a[data-slot='item']:hover, .turnfin-app .tf-main [data-slot='item-group'] > [role='listitem'] > a[data-slot='item']:hover { background: var(--pc-surface-sunken); }`.

2) In poolside.css:597-600, apply the body-cell rules (padding, lines, radius, surface, row hover) to `:is([data-slot='table-cell'], [data-slot='table-head'])` inside `[data-slot='table-body']`. For the body-row th, also set `height: auto; text-align: left; color: var(--pc-ink); font-size: var(--pc-text-body); line-height: var(--pc-leading-body); font-weight: 400`. That is the regular cell weight shown in SSAnalytics; a name inside keeps its own 600. Also add `.turnfin-app [data-slot='table']:not([data-layout='grid']) [data-slot='table-header'] { background: none; }`, which removes the bg-ui-muted band from instructor-report.tsx:41 and :67.

3) Set `.pc-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }`, the V2System .stats rule, instead of auto-fill 160. Add `.turnfin-app a.pc-stat[aria-current] { box-shadow: inset 0 0 0 2px var(--pc-primary); }`. Add the canvas variant from V2Refunds, TROverview and SSAnalytics: a `.pc-stats` that is not inside `.pc-panel`, a card or a dialog uses `grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 16px`, and its `.pc-stat` tiles use `background: var(--pc-surface); border-color: transparent; border-radius: var(--pc-radius-panel); padding: 24px`. Refunds `.refund-summary` (refunds.css:16-26 and 79-94) and the Docs `.task-queues a[aria-current]` rule (poolside.css:309) can then move to .pc-stats/.pc-stat in their module tasks and be deleted.

4) Add `.turnfin-app .pc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start; min-width: 0; }`. Use auto-fit, not auto-fill. Replace the inline styles at home-view.tsx:42 and module-overview.tsx:34 with `className="pc-grid"`.

5) Drop. Do not add --pc-yellow-hover. The do-first row keeps `background: var(--pc-yellow)` on hover, as V2System sets it and poolside.css:539 already does.

6) Keep `.turnfin-app .tf-main > .module-content { display: flex; flex-direction: column; gap: 16px; }`, and module tasks remove their gap-6/space-y-6 wrappers. In the same change, rewrite DESIGN.md:222-223 to say 16px between page blocks, matching DESIGN.md:32 and every mockup's .main gap. Note that instructor-shell.tsx:111 and help-frame.tsx:22 render .tf-main without .module-content, so they need the same gap.

7) In item.tsx:124, change ItemTitle to `flex w-fit items-center gap-2 text-sm font-semibold`. In item.tsx:137, change ItemDescription to `text-xs font-normal text-ui-muted-foreground` with no line-clamp or text-balance. In table.tsx, replace `font-medium` with `font-semibold` on TableHead (line 72) and TableFooter (line 46). Do not just delete it, because th would fall back to the browser's bold (700). To meet the Account acceptance, also replace the ad hoc `<div className="text-sm font-medium">` / `<div className="text-sm text-ui-muted-foreground">` pairs with ItemTitle/ItemDescription in app/(core)/account/page.tsx:62-66. Do the same in app/(core)/clubs/page.tsx, app/(activities)/programmes/[id]/page.tsx, app/(core)/staff/devices/page.tsx, app/(core)/staff/[id]/page.tsx and modules/activities/components/{attendance/class-session, duty/billing-list, progression/assessment, together/combination-list}.tsx.

8) Rewrite DESIGN.md:198-199 as follows: "Figure tiles are .pc-stat: icon, figure over label, caption. Inside a panel a tile is 16px with a 1px line, two per row. On the canvas it is a borderless white 24px tile. A tile that filters shows a soft fill on hover and a 2px blue edge when open (aria-current)." Do not add the line about turning phone tables into rows. The mockups keep tables in .hscroll, so that rule needs an owner decision as a separate task.

Acceptance:
- /students rows darken on hover.
- The first column of /analytics daily activity (1280 light) and /analytics/instructors (1024 dark) sits inside the row card in regular weight.
- On /rota/overview as noah, the single tile is half the panel width.
- Home's Today panel keeps two tiles per row at 1280 and 1024.
- The overviews keep two panels side by side at 1280 with no empty track.
- On Account, the 'What you can do' rows show a 600 title over a 12px caption.
- typecheck passes.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) As specified. Split poolside.css:626 into `.turnfin-app .tf-main [data-slot='item-group'] > a[data-slot='item']:hover, .turnfin-app .tf-main [data-slot='item-group'] > [role='listitem'] > a[data-slot='item']:hover { background: var(--pc-surface-sunken); }`.

2) Rows 597-600:
- Rewrite them with `:is([data-slot='table-cell'], [data-slot='table-head'])` inside `[data-slot='table']:not([data-layout='grid']) [data-slot='table-body']`. This covers padding, border-top/bottom, background, vertical-align, the :first-child and :last-child edge and radius rules, AND the row :hover background rule.
- Add ONE rule only for `... [data-slot='table-body'] [data-slot='table-head']`: `{ color: var(--pc-ink); font-size: var(--pc-text-body); line-height: var(--pc-leading-body); font-weight: 600; }`.
- Do NOT put size, colour or weight on td. Poolside is unlayered and would override muted or weighted TableCell classes (students/parent-changes/page.tsx:52, staff/details-requests/page.tsx:51).
- Optional, existing issue: add `font-normal` to the caption <p>s inside the analytics row headers (instructor-report.tsx caption lines ~45, 74, 77-78; reception-report.tsx ~41) so they stop inheriting 600.

3) `.pc-stats { grid-template-columns: repeat(auto-fill, minmax(min(100%, 128px), 1fr)); }`. Keep 128px; 160px collapses home to one column at 375 and 1280. Open state: `.turnfin-app a.pc-stat[aria-current] { border-color: var(--pc-primary); box-shadow: inset 0 0 0 1px var(--pc-primary); }`, an exact 2px blue edge. Primary vs surface is 5.82 light / 7.08 dark; vs sunken 5.37 / 6.54.

4) `.turnfin-app .pc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start; min-width: 0; }`. Use auto-fit, not auto-fill: auto-fill leaves an empty third column on overviews at 1280. Then replace the inline style in src/components/home/home-view.tsx:42 and src/components/workspace/module-overview.tsx:34 with className="pc-grid".

5) Drop. The approved sheet keeps the yellow on hover (`.item.first:hover{background:var(--yellow)}`), and poolside.css:539 copies it on purpose. Only with owner sign-off: --pc-yellow-hover: light-dark(#f9dc80, #57461a), which keeps --pc-on-yellow at 10.3:1 and 7.45:1.

6) Target every ModuleShell content wrapper, not only .module-content:
- In src/components/workspace/module-shell.tsx:70 render `className={`tf-content ${contentClass}`}`.
- Add `.turnfin-app .tf-main > .tf-content { display: flex; flex-direction: column; gap: 16px; }`.
- Next to poolside.css:634, add `.turnfin-app .tf-main .workspace-page-content > * { margin-inline: 0; }`. docs.css:4730's auto margins would otherwise shrink the Docs root in a flex column.
- Record in DESIGN.md that the rule takes effect only when pages return their blocks as direct children (fragments) instead of one gap-6/space-y-6 wrapper. Any inline-level direct child (a back link, a lone button) needs `self-start`, otherwise it stretches full width.

7) item.tsx:
- ItemTitle: `flex w-fit items-center gap-2 text-sm font-semibold` (no leading-snug).
- ItemDescription: `text-xs text-ui-muted-foreground text-balance` plus the existing link classes, no line-clamp.
- In src/app/(core)/account/page.tsx:63-66, replace the inline divs with <ItemTitle>{permission.label}</ItemTitle><ItemDescription>{permission.description}</ItemDescription>. The acceptance check depends on this.
- Same swap where the same inline pattern appears: clubs/page.tsx:98-117, staff/devices/page.tsx:58-61, staff/organisation/page.tsx:47-50 and 80-83, programmes/[id]/page.tsx:160-172.

table.tsx: change TableHead's `font-medium` to `font-semibold` instead of deleting it; a bare th falls back to the browser's bold (700). Removing font-medium from TableFooter is fine (no consumers).

8) DESIGN.md:198-199 as specified: summary tiles are .pc-stat, a 16px tile with a 1px line; a filtering tile shows a soft fill on hover and a 2px blue edge (aria-current) when open. Also add the Layout line (tables that would hide columns on phones render .pc-rows below 768px), and that page grids use .pc-grid with auto-fit.

## Acceptance
/students rows darken on hover (cdp-hover). /analytics daily activity and /analytics/instructors first column sit inside the row card at 1280 light and 1024 dark. On /rota/overview as noah, the single tile keeps tile width. Account 'What you can do' rows show a 600 title over a 12px caption. typecheck passes.

## Verification notes
- KEEP: The problem is real today, but three parts of the proposed change would move away from the approved mockups.

Confirmed:
(1) Item rows get no hover. The selector at poolside.css:626 can never match an anchor inside [role=listitem]. On /students at 1280 light, cdp-hover reported NO-HOVER for the A|item row "Quinn Fictional". The module rule .row:hover (student-directory.module.css) loses to poolside.css:625, which is (0,5,0) and unlayered.
(2) Row headers float outside the row card. On analytics-1280-light.png the Daily activity Mon–Today labels sit outside the card, and on analytics_instructors-1024-dark.png the instructor name does too. The cause is that TableHead scope=row (dashboard.tsx:81, instructor-report.tsx:43/72, reception-report.tsx:39) picks up the caption-styled head rule at poolside.css:595 and none of the body-cell rules at 597-600.
(3) A single tile stretches. On rota_overview-1280-light.png (noah), one tile fills the whole 1046px panel. The cause is auto-fit at poolside.css:543.
(4) Refunds draws its own open-filter tile (refunds.css:16-26, a 2px inset when aria-current). Docs uses a soft fill instead (poolside.css:309).
(5) The panel grids use different minimums: 320 in home-view.tsx:42 and 380 in module-overview.tsx:34.
(6) Page spacing differs. 14 pages use gap-6 and 12 use space-y-6, while home and the overviews use gap-4. Every mockup's .main gap is 16px, as DESIGN.md:32 says.
(7) ItemTitle is font-medium (item.tsx:124), ItemDescription is 14px with line-clamp-2 (item.tsx:137), and TableHead is font-medium (table.tsx:72).

Where the change contradicts the mockups or fails its own acceptance:
- Item 3 (auto-fill 160px): Home's Today panel grid is 306px wide at 1280 (measured by probe). At a 160px minimum it drops to one column, but V2Home shows two tiles per row. V2System .stats is repeat(2, minmax(0,1fr)), the same in all 93 mockups, and V2Overview and ROOverview both show tiles at half the panel width.
- Item 4 (auto-fill): the overview grid is 1094px wide at 1280. auto-fill at 320 makes 3 tracks, so the two overview panels leave a 354px empty column. V2Home uses auto-fit 320, and V2Overview and ROOverview use auto-fit for their panels.
- Item 5: V2System sets `.item.first:hover{background:var(--yellow)}` on purpose, and poolside.css:539 copies it. A --pc-yellow-hover token adds a concept that goes against the approved sheet.
- Item 8: DESIGN.md:198 ("borderless white tiles") is correct for summary tiles placed directly on the canvas. V2Refunds, RFDetail, TROverview, SSAnalytics, SSAnalyticsInstructors, SSAnalyticsReception, DCReports and SSClassDetail all draw them with background panel, a transparent border, 24px radius and 24px padding. Only tiles inside a panel are 16px with a 1px line. The proposed rewrite would push Refunds away from V2Refunds. The proposed new phone-table Layout line is not part of the problem, and nothing in the mockups supports it: tables sit in .hscroll with min-width 760px, and no mockup turns a table into rows.
- Row header weight 600: SSAnalytics shows "Monday" in regular weight. It is a plain td; names carry their own .strong.
- Item 7 cannot meet the Account acceptance. ItemDescription has no users and ItemTitle has two, both overridden by module CSS. Account builds its rows from ad hoc divs (account/page.tsx:62-66), and 8 more files do the same.
- Removing font-medium from TableHead lets the browser's default bold (700) show on grid-table heads, because Tailwind preflight does not reset th.
- DESIGN.md:222-223 still says 24px gaps for Swimmers and Classes, which contradicts item 6.

Evidence: shots/audit2/sys11v/{analytics-1280-light, analytics_instructors-1024-dark, account-1280-light, rota_overview-1280-light, preview_V2Home_html-1280-light, preview_V2Overview_html-1280-light, preview_ROOverview_html-1280-light, preview_SSAnalytics_html-1280-light, preview_ADAccount_html-1280-light}.png in the scratchpad.
- KEEP: The task is real, but steps 3 and 4 as written break layouts, steps 6 and 7 don't reach their targets, and step 5 goes against the approved component sheet. Evidence:

(1) Hover selector: confirmed. poolside.css:626 can never match. I tested the proposed split in the live sandbox. /students at 1280 light goes from rgb(255,255,255)→rgb(255,255,255) (no hover) to →rgb(244,246,249). /courses at 1280 dark goes from rgb(19,28,43) unchanged to →rgb(24,35,52).

(2) Table row headers: confirmed. Line 595 styles every th, body ones included, as a 12px muted header. Analytics row headers (dashboard.tsx:81, instructor-report.tsx:43/72, reception-report.tsx:39) therefore sit outside the row card. I injected the proposed rules on /analytics/instructors at 1280 and the row card then encloses the first column (shots/audit2/sys11/instr-compare.png). Risk: poolside.css is unlayered, so it beats Tailwind utilities. If size, ink colour and 600 are applied to td as well, they flatten the 6 TableCells that carry their own colour or weight classes, e.g. students/parent-changes/page.tsx:52 and staff/details-requests/page.tsx:51 (text-ui-muted-foreground). The hover rule (line 600) also has to include the th. Weight 600 already reaches body th today through line 595, so the bold captions inside the report row headers are an existing issue, not a new one.

(3) .pc-stats at 160px: regression. Measured live, the home Today grid is 306px wide at 1280 and 311px at 375. With minmax 160 auto-fill it drops to a single column ("306px" / "311px"), while the V2Home/V2System .stats is 2 columns. Keeping 128px and switching only to auto-fill keeps home at "147px 147px" and gives the single rota tile 155px. Separately, a 2px inset shadow inside the existing 1px line border draws a grey line plus a 2px blue inset (3px total).

(4) .pc-grid with auto-fill: regression. Simulated at 1280, /rota/overview and /swim-school (2 panels) become "354px 354px 354px", leaving an empty third column. auto-fit keeps "539px 539px", and both mockups use auto-fit (V2Home 320, V2Overview 420). auto-fit at 320 matches the current 380 overview layout at 768, 1024 and 1280. The class is also unused unless home-view.tsx:42 and module-overview.tsx:34 adopt it.

(5) Yellow hover: V2System, V2Home and V2Overview all set .item.first:hover{background:var(--yellow)}, and poolside.css:539 copies that on purpose. A new token adds a concept the owner didn't approve.

(6) .module-content flex rule: measured on 19 routes, every content wrapper has exactly one child (section.space-y-6, div.gap-6, div.gap-4…), so the rule does nothing. Refunds (.refund-content) and Docs (.page-content.workspace-page-content) aren't .module-content at all. If extended to Docs, docs.css:4730 (`.workspace-page-content > * { margin-left/right: auto }`, @layer components, all widths) would shrink the Docs root to fit its content in a flex column.

(7) item.tsx reaches almost nothing. ItemDescription has 0 consumers. ItemTitle is used only in student-directory.tsx:25 and class-browser.tsx:54, whose CSS-module .name already sets 600. The account 'What you can do' rows are inline divs (account/page.tsx:63-66, `text-sm font-medium` over `text-sm text-ui-muted-foreground`), so that acceptance check fails without editing that page. Deleting font-medium from TableHead leaves th on the browser's default bold (700), because Tailwind preflight resets only h1-h6.

Lint, typecheck and import boundaries: no new imports cross Instructor/Activities; account/page.tsx already imports from @/components/shadcn/item.