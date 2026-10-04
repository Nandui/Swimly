# SYS-17 — Avatar and meter primitives match the sheet
Severity: low | Scope: system

## Files (expected)
- src/app/docs/docs.css
- src/app/docs/poolside.css
- src/components/docs/admin.tsx
- src/components/docs/reader.tsx
- src/components/docs/reports.tsx
- src/components/docs/ui.tsx
- src/components/shadcn/avatar.tsx
- src/components/shadcn/progress.tsx
- src/components/workspace/account-menu.tsx
- src/modules/activities/components/analytics/dashboard.tsx
- src/modules/activities/components/instructor/instructor-shell.tsx
- src/modules/activities/components/students/swimmer-profile.module.css
- src/modules/activities/components/students/swimmer-profile.tsx

## Problem
Avatar defaults to 32px on bg-ui-muted with 14px/400 initials. Docs' own Avatar tints initials blue, and the swimmer profile uses a custom 56px avatar. Progress uses a translucent primary track (bg-ui-primary/20) with a square-ended bar, while the V2System meter is an 8px sunken track with a rounded blue bar.

## Change (original)
avatar.tsx: sizes 32 (bars), 40 (rows) and 64 (profile) through a size prop; fallback on --pc-surface-sunken with a 1px inset --pc-line and 12px/600 initials (colour never decorative). progress.tsx:16: track --pc-surface-sunken, height 8px, rounded --pc-primary indicator. Module tasks replace docs/ui Avatar and the profile's custom avatar with it.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
avatar.tsx: make the sizes match the sheet's classes. size="sm" is 32px (bars), the default is 40px (rows), size="lg" is 64px (profile).
- Fallback: var(--pc-surface-sunken), color var(--pc-ink), box-shadow inset 0 0 0 1px var(--pc-line), 12px/600 (text-xs font-semibold).
- lg: 18px/600 initials (text-lg font-semibold, i.e. --pc-text-title / --pc-leading-title).
- Add one tone="me" for the signed-in user's own avatar only: var(--pc-primary-soft) fill, var(--pc-primary-ink) initials, no inset line (V2System .avatar.me).
- Give AvatarGroupCount the same fallback styling.

Callers:
- account-menu.tsx:28 and :31 use <Avatar size="sm" tone="me">.
- instructor-shell.tsx:88 uses the same and drops its bg-ui-brand-soft/text-xs/size-8 classes.
- Docs member avatars (admin.tsx:203 and :252, reader.tsx:309, reports.tsx:269) use the neutral shared Avatar: default size for rows, sm where it is inline. Then delete the Avatar wrapper in docs/ui.tsx:52-70, or reduce it to an initials helper.
- swimmer-profile.tsx:58 uses <Avatar size="lg"> and drops text-[inherit].

Delete the overrides this replaces:
- poolside.css:470-471 (.tf-who .avatar)
- poolside.css:299 (hard-coded teal sidebar avatar; no tsx renders .workspace-sidebar anymore)
- docs.css:313-330, 3969-3973 and 4449-4454 (.avatar, .avatar.small, .staff-cell .avatar)
- swimmer-profile.module.css:24-38 and 204-208 (.avatar)

progress.tsx:
- Root: h-2 rounded-full overflow-hidden, background var(--pc-surface-sunken).
- Indicator: rounded-full, background var(--pc-primary).

Delete the call-site restyling so the primitive shows through:
- swimmer-profile.module.css:133-147 (.progress height 0.4rem, --ui-radius and the --ui-status-green indicator). Keep at most a max-width.
- dashboard.tsx:53 className "h-2 bg-ui-muted".
- docs.css:2353-2368 and 7403-7409 height overrides on .completion-track. Keep only the positioning.

Acceptance: at 1280 light and dark, the following match V2System:
- /students/<id>: 64px neutral avatar, 18px initials, and a blue meter on a sunken 8px track.
- Top bar: 32px blue "me" avatar.
- /docs/admin rows: 40px neutral avatars with 12px/600 initials.
- /docs/reports: sunken track with a rounded blue bar.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1. src/components/shadcn/avatar.tsx
- Keep the existing `size` prop and set it to the sheet's three sizes: "default" = size-8 (32, bars), "lg" = size-10 (40, rows), "xl" = size-16 (64, profile). Drop "sm" (24px); nothing uses it.
- Delete AvatarBadge, AvatarGroup and AvatarGroupCount. Grep finds no consumers.
- Add a boolean `self` prop for the signed-in person. It renders `data-self` on the Root.
- AvatarFallback classes: `flex size-full items-center justify-center rounded-full bg-ui-muted text-ui-foreground text-xs font-semibold shadow-[inset_0_0_0_1px_var(--ui-border)] group-data-[size=xl]/avatar:text-lg group-data-[self]/avatar:bg-ui-brand-soft group-data-[self]/avatar:text-ui-brand-ink group-data-[self]/avatar:shadow-none`.
  - text-lg is 18px with 24px leading (poolside.css:95, 97-98), matching V2System `.avatar.lg`.
  - The self tone matches V2System `.avatar.me`.
  - Use the --ui-* tokens only, no raw --pc-* values.
- Optionally export a small `initials(name)` helper from the same file, so the two copies of the split/slice logic go away.

2. src/components/shadcn/progress.tsx
- Line 16: replace `bg-ui-primary/20` with `bg-ui-muted` and keep `h-2 rounded-full`.
- Indicator: add `rounded-full`. Keep `bg-ui-primary` and the translateX approach.

3. Same change: move every avatar and meter consumer, so nothing regresses in between.
- swimmer-profile.tsx:58: use `<Avatar size="xl" aria-hidden="true">` and drop `text-[inherit]`.
- swimmer-profile.module.css:
  - Delete `.avatar` (lines 24-38) and the @container `.avatar` rule (lines 204-208); V2PhoneProfile also uses 64px.
  - In `.progress` (lines 133-147), delete height, border, border-radius, overflow, background, max-width and the whole `[data-slot="progress-indicator"]` rule (it sets --ui-status-green). Keep only spacing. The V2Profile meter spans its column.
- analytics/dashboard.tsx:53: drop `className="h-2 bg-ui-muted"`. Those are now the defaults.
- workspace/account-menu.tsx:28 and :31: import Avatar from @/components/shadcn/avatar and render `<Avatar self aria-hidden="true">` with initials.
- instructor-shell.tsx:88: use `<Avatar self>` and remove the `avatar size-8` and colour classes from the call site.
- docs/ui.tsx:52-70: make the Docs Avatar a thin wrapper, or replace its uses.
  - Drop the `avatar` class.
  - `small` becomes the default size (32): admin.tsx:252, reader.tsx:309, reports.tsx:269.
  - Row avatars use size "lg" (40): admin.tsx:203.
- Delete the now-dead avatar CSS:
  - docs.css: 313-330, 3969-3973 and 4449-4454.
  - poolside.css:299 (it hard-codes teal hex values).
  - poolside.css:470-471. The primitive now supplies 32px, no border and 12/600.

4. Verify
- Screenshot at 1280 in light and dark, and also at 375:
  - /students/cmutm2a5u000nqkluiz9dhrn2: 64px neutral avatar with an inset line; 8px sunken meter with a rounded blue bar.
  - The top bar on any core page and on /instructor: 32px tinted self avatar with no ring.
  - /docs/reports and the Docs admin staff list: a single ring only.
- Run npm run lint (import boundaries) and the typecheck.

## Acceptance
/students/<id> progress bars and the top-bar, row and profile avatars at 1280 light and dark match V2System.

## Verification notes
- KEEP: The problem is real today. One part of the proposed change contradicts the approved sheet, and the change as written would not meet its own acceptance check.

Confirmed in code and screenshots (shots/audit2/sys17):
- avatar.tsx:19 sizes are 24/32/40. avatar.tsx:48 sets the fallback to bg-ui-muted with text-sm (14px/400) and no inset line.
- progress.tsx:16 track is bg-ui-primary/20. Measured on /docs/reports at 1280 light: rgb(210,223,246), a translucent blue. Sheet value: #f4f6f9 (sunken).
- progress.tsx:24 indicator has no rounding, so the bar end is square.
- Swimmer profile (/students/cmutm2a5u000nqkluiz9dhrn2 at 1280, light and dark): avatar is a custom 56px circle with no inset line and text-xl initials (swimmer-profile.module.css:24-38, plus text-[inherit] at swimmer-profile.tsx:58). V2Profile.html has 64px, a 1px inset line and 18px initials.
- The profile meter is overridden to 0.4rem with --ui-radius and a GREEN indicator, --ui-status-green (swimmer-profile.module.css:133-147). That is status colour at a call site. V2System is an 8px sunken track with a rounded --pc-primary bar (V2System.html:176-177).
- Docs staff rows (/docs/admin) and the document owner avatar render blue-tinted, bordered, about 36px, with 700 initials. Sources: docs.css:313-330, docs.css:4449-4454 and docs/ui.tsx:61. The sheet's row avatar is neutral, 40px, 12px/600.

Where the change goes wrong:
1. The sheet defines `.avatar.me` (V2System.html:104): --pc-primary-soft fill, --pc-primary-ink initials, no inset line. It is the signed-in user's own avatar in the bar (V2System.html:247) and in the account menu (line 306). The live top bar already matches it (crops z_live_bar_light vs z_mock_bar). "Colour never decorative" plus "replace docs/ui Avatar" would make that avatar neutral and move away from the sheet. Contrast is fine: 6.82:1 light, 8.41:1 dark.
2. The 64px profile avatar uses 18px/600 initials (V2System.html:103), not 12px.
3. Fixing progress.tsx alone will not make /students/<id> match. The module override (green indicator, 0.4rem) would still win. docs.css:7403-7409 and dashboard.tsx:53 also restyle the bar.

The proposed tokens pass contrast: primary on sunken is 5.37:1 light and 6.54:1 dark.
- KEEP: The direction is right, but as written the change misses its own acceptance and causes two visible regressions. Each can be fixed by amending it.

(1) The top-bar avatar must stay tinted. The V2System top bar uses `.avatar.me.sm`: background --pc-primary-soft, text --pc-primary-ink, no inset line (V2System.html lines 84, 104 and 247). V2Home, V2Profile, V2PhoneProfile and DCReports do the same. The live top bar already matches through docs/ui.tsx:61 (bg-ui-brand-soft text-ui-brand-ink, used by workspace/account-menu.tsx:28 and :31) and instructor-shell.tsx:88. If the module tasks swap these for a neutral fallback ("colour never decorative"), the top bar stops matching the sheet, so the acceptance fails. The tint carries meaning: it marks the signed-in person. Contrast is 6.82:1 in light and 8.41:1 in dark. Instructor-shell cannot import docs/ui because eslint.config.mjs:51 bars Activities from importing Work modules. So the tone has to live in the shared shadcn primitive.

(2) The /students/<id> progress bar would not change. swimmer-profile.module.css:133-147 is an unlayered CSS module, so it beats the Tailwind utilities from progress.tsx. It sets height 0.4rem, border-radius var(--ui-radius), background --ui-muted, a 25rem max-width, and a green indicator (--ui-status-green, which is a status colour picked at the call site). Editing progress.tsx alone leaves the live bar unchanged (screenshot shots/audit2/sys17/students_cmutm2a5u000nqkluiz9dhrn2-1280-light.png). The profile avatar has the same problem: .avatar at lines 24-38 sets 56px with 18px text, and the @container rule at line 204 shrinks it to 48px. The sheet's profile avatar is 64px with 18/24 initials (V2System line 103), on V2PhoneProfile too.

(3) Docs avatars would get a double ring. docs.css:4449 sits in @layer components and puts a 1px --ui-brand-border border on the `.avatar` root. docs.css:313 is a legacy rule that adds a 1px --line border. The primitive has no border utility, so these borders apply today. Adding an inset --pc-line shadow on the fallback would draw a second ring on every Docs avatar: admin.tsx:203 and :252, reader.tsx:309, reports.tsx:269 and the sidebar account menu. The top bar is spared only because poolside.css:470 is unlayered and sets border 0. So the Docs consumers have to move in the same change, not in a later module task.

(4) The spec has smaller errors. The sheet's profile initials are 18/24, not 12. The primitive already has a `size` prop (sm 24, default 32, lg 40), and AvatarBadge, AvatarGroup and AvatarGroupCount read data-size; a grep finds no consumers of those three. --ui-muted already equals --pc-surface-sunken (poolside.css:117), --ui-border equals --pc-line, and text-xs equals 12px. shadcn primitives should use the --ui-* tokens, not raw --pc-* values.

Elsewhere the blast radius is safe:
- Progress has three consumers. analytics/dashboard.tsx:53 overrides with h-2 bg-ui-muted, which becomes redundant. docs/reports.tsx:121 .completion-track keeps its unlayered 6px height and absolute position from docs.css:7403. swimmer-profile.tsx is covered above.
- The accessible names and aria-valuetext of the progress bars don't change.
- I found no tests or e2e selectors that reference avatar or progress slots.
- No new import edges: Activities already imports @/components/shadcn.