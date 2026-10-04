# SYS-15 — Account menu as approved (V2Home-menu), reusable by the deck
Severity: medium | Scope: system

## Files (expected)
- DESIGN.md
- assets/help/instructor-menu.png
- assets/help/manifest.json
- docs/instructor.md
- scripts/help-screenshots/capture.mjs
- scripts/help-screenshots/fixture.jsx
- src/app/docs/poolside.css
- src/app/layout.tsx
- src/components/docs/ui.tsx
- src/components/theme-toggle.tsx
- src/components/workspace/account-menu.tsx
- src/components/workspace/module-shell.tsx
- src/components/workspace/your-modules.tsx
- src/lib/clubs/current.ts
- src/lib/greeting.test.ts
- src/lib/greeting.ts
- src/modules/activities/components/instructor/instructor-shell.tsx

## Problem
The menu departs from the approved V2Home-menu. Its header is a time greeting over the name at weight 500, with no avatar and no 'role · site' line. Appearance is a vertical radio list with dot bullets and 7.2px items. It has separator lines, items at weight 400, and a 16px panel radius. Help opens in a new tab. Sign-out errors say 'Please try again'. The unused 'sidebar' variant and compact prop remain. The pool deck keeps a separate copy of this menu because AccountMenu cannot hide Manage account or point Help at /help/instructor.

## Change (original)
1) Header: shadcn Avatar (40px, neutral), the name at font-semibold and a caption '<role> · <site>'. Extend YourModulesProvider's value to {ids, role, site} (set once in src/app/layout.tsx from the session and working site) so no shell has to pass them. 2) Then the 'Appearance' caption and the shared ThemeToggle segmented control (SYS-06), then Manage account, then Help (same tab; href from a helpHref prop defaulting to '/help'), then Sign out. No separators, no greeting. The items use the SYS-05 menu item rule. Keep Help in the menu, because DESIGN.md:86 lists it. 3) Delete the 'sidebar' variant, compact and onNavigate (if unused). Add showManageAccount (default true) for the deck. The error toast reads 'Could not sign out. Try again.'.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Make the account menu match V2Home-menu exactly, and have the deck reuse it.

1) Context. Extend YourModulesProvider in src/components/workspace/your-modules.tsx so its value is {ids, role, site}. Set it once in src/app/layout.tsx:
- role: session.user.roleName;
- site: getCurrentClub().then(c => c.club.name, () => null), only when session.user exists.
Add a useAccount() hook so no shell has to pass these. switchClub already revalidates the layout.

2) Header. Reuse the existing `Avatar` from src/components/docs/ui.tsx. It is the shadcn Avatar with the primary-soft fill, which is the mockup's `.avatar.me`; do not make a neutral one. Draw it at 40px, beside:
- the name at text-sm font-semibold;
- a text-xs muted caption '<role> · <site>' (role alone when site is null).
No greeting, no separators.

3) Body.
- An 'Appearance' caption (text-xs font-semibold muted) over the shared ThemeToggle restyled as the pill segmented control (SYS-06; today theme-toggle.tsx:34,43 uses rounded-ui-lg/md and font-medium), full width.
- Then exactly two items: Manage account and Sign out. Each is 44px, pill, weight 600, with a sunken fill on hover (the SYS-05 menu item rule).
- Content: w-80 max-w-[calc(100vw-2rem)], p-4, gap-4, and rounded-ui-xl, which poolside.css:184 already maps to --pc-radius-panel (24px).
- Remove Help from the account menu. It already lives in the rail (module-shell.tsx:156), the phone bottom bar's More (module-shell.tsx:187) and the deck's top bar (instructor-shell.tsx:83), all opening in a new tab as DESIGN.md:294 says. Do not add a helpHref prop.
- Update DESIGN.md:86 and :294 to say the account menu holds Appearance, Manage account and Sign out, and that Help sits in the rail, the bottom bar's More and the deck bar.

4) Clean-up.
- Delete the 'sidebar' variant, compact, onNavigate and the variant prop; the bar trigger is the only trigger.
- Delete greeting(): src/lib/greeting.ts and src/lib/greeting.test.ts, which have no other user.
- Delete the .workspace-account rules (poolside.css:229-233).
- The error toast reads 'Could not sign out. Try again.'.
- The trigger's aria-label becomes 'Account: <name>, <role>', as in the mockup.

5) Deck. Add showManageAccount (default true). Replace the menu copy in src/modules/activities/components/instructor/instructor-shell.tsx:86-104 with <AccountMenu showManageAccount={false} />. This also fixes its deprecated signOut({callbackUrl}). Keep the deck's top-bar Help link as it is.

Acceptance:
- At 1280 light and dark and at 375, the menu shows the primary-soft 40px avatar, the name at 600 and the 'role · site' caption, the pill Appearance control, and Manage account and Sign out at 44px and weight 600 on a 24px panel with no separators.
- It matches V2Home-menu side by side.
- The deck shows the same menu without Manage account.
- grep finds no variant="sidebar", greeting( or workspace-account.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
SYS-15, amended. Account menu as approved (V2Home-menu), reusable by the deck.

1) src/components/workspace/your-modules.tsx
- Change the context value to {ids: readonly string[]; role: string; site: string}. The default is {ids: [], role: '', site: ''}.
- useYourModules() reads .ids.
- Export useYourAccount(): {role, site}.
- YourModulesProvider takes ids, role and site props.
- Delete the unused YourModulesNav and HelpButton. grep shows no imports of either. Keep HomeButton, which ui-kit/app-shell.tsx uses.

2) src/app/layout.tsx
- When session?.user exists, pass role = session.user.roleName. In View as this is the worn role.
- Pass site = (await getCurrentClub()).club.name inside try/catch, falling back to ''. Follow auth.ts:144-146. This adds no query because it is cached per request.
- When signed out, pass empty strings.

3) src/components/workspace/account-menu.tsx
- Props: {name: string; helpHref?: string (default '/help'); showManageAccount?: boolean (default true)}.
- Remove variant, compact, onNavigate, the sidebar trigger, ChevronsUpDown, greeting and the '@/components/docs/ui' import.
- Trigger: keep Button ghost 'tf-bar-item tf-who' with aria-label `Account menu: ${name}`. Use shadcn Avatar/AvatarFallback with className 'avatar' (so poolside.css:470-471 still sizes it to 32px) and initials in bg-ui-brand-soft text-ui-brand-ink. Use one local initials helper.
- Header (DropdownMenuLabel): shadcn Avatar size="lg" (40px) in the same brand-soft colours, matching the mockup's .avatar.me. Next to it, the name at font-semibold and a caption from useYourAccount(): '<role> · <site>'. Join only the non-empty parts. Leave the caption out when both are empty, so fixtures without the provider render cleanly.
- Appearance: the caption 'Appearance' (DropdownMenuLabel, weight 600), then DropdownMenuRadioGroup aria-label="Appearance" with three DropdownMenuRadioItem (System, Light, Dark with Monitor, Sun, Moon) laid out as one horizontal pill segmented row. Do not nest the ThemeToggle RadioGroup: Radix menus cancel Tab, so it would be unreachable from the keyboard. Each item gets onSelect={(e) => e.preventDefault()} so the menu stays open. Hide the shadcn dot indicator and the pl-8 inset. Reuse the same CSS as SYS-06's segmented control so both look identical.
- Then Manage account (only when showManageAccount), then Help, then Sign out. No separators. Items are min-h-11 at font-semibold, following the SYS-05 item rule.
- Help keeps target="_blank" rel="noopener noreferrer" and the sr-only ' (opens in a new tab)'. This matches the rail and bottom bar (module-shell.tsx:156, 187), DESIGN.md:294 and docs/help-centre.md:5, and protects unsaved forms such as refunds/request-form.tsx. Same-tab Help across all entry points would be a separate change that also updates both docs.
- Error toast: 'Could not sign out. Try again.'

4) src/app/docs/poolside.css
- Add an unlayered, scoped rule for the account menu content, e.g. `.turnfin-app .tf-account-menu[data-slot='dropdown-menu-content'] { border: 0; border-radius: var(--pc-radius-panel); padding: 16px; display: flex; flex-direction: column; gap: 16px; }`, and put className "tf-account-menu w-80 max-w-[calc(100vw-2rem)]" on the content. Tailwind utilities lose to the unlayered rule at line 366. Do not change the shared rule at line 366.
- Delete the dead .workspace-account* rules (lines 229-233).

5) src/components/workspace/module-shell.tsx:83
- Change to <AccountMenu name={who.name} />.

6) src/modules/activities/components/instructor/instructor-shell.tsx
- Replace the inline menu (lines 85-105) with <AccountMenu name={userName} helpHref="/help/instructor" showManageAccount={false} />.
- Remove the now-unused imports: signOut, useThemeMode, parseThemeMode, the shadcn Avatar, the dropdown parts, Monitor/Sun/Moon/LogOut/ChevronDown. Unused imports would fail lint.
- Keep the top-bar Help icon from the approved DeckHome mockup.

7) Delete src/lib/greeting.ts and src/lib/greeting.test.ts, which nothing else uses.

8) Help screenshots
- scripts/help-screenshots/capture.mjs:23: change the click label from 'Instructor menu: Alex Example' to 'Account menu: Alex Example'.
- scripts/help-screenshots/fixture.jsx:52: wrap InstructorShell in <YourModulesProvider ids={[]} role="Instructor" site={sites[0].name}>.
- Regenerate assets/help/instructor-menu.png and its height in assets/help/manifest.json.

9) Docs
- docs/instructor.md:40: the deck menu is now the shared account menu (appearance, help, sign-out; no Manage account).
- DESIGN.md:92: replace 'its own menu' with 'the shared account menu without Manage account'.

Acceptance: at 1280 light and dark and at 375, the menu shows a 40px brand-soft avatar, the name, the 'role · site' caption, the pill Appearance row and 44px items at weight 600 on a 24px panel with no separators. It matches V2Home-menu side by side except for the Help row, which is kept per DESIGN.md:86. From the keyboard: open the menu, then ArrowDown reaches System, Light, Dark, Manage account, Help and Sign out, and Enter on Dark switches the theme. grep finds no variant='sidebar', no greeting( and no '@/components/docs/ui' in src/components/workspace. ClubSwitcher and the More menus still have a 16px radius. npm run lint, typecheck and test pass. The deck menu has no Manage account, and Help opens /help/instructor in a new tab.

## Acceptance
The account menu at 1280 light and dark and at 375 shows the avatar, name and role · site caption, the pill Appearance control and 44px items at weight 600 on a 24px panel, and matches V2Home-menu side by side. Help opens in the same tab. grep finds no variant='sidebar'.

## Verification notes
- KEEP: The problem is real. Code and a live screenshot confirm every claim. In src/components/workspace/account-menu.tsx the header (line 38) is greeting() over the name, with no avatar and no role or site. Appearance is a DropdownMenuRadioGroup with dot bullets (lines 41-45), separated by DropdownMenuSeparator (lines 39 and 46). Help has target="_blank" (line 48). The error toast reads 'Could not sign out. Please try again.' (line 24). The 'sidebar' variant, compact and onNavigate (line 18) are unused: the only call site is module-shell.tsx:83 with variant="bar". The pool deck keeps its own copy of the menu (instructor-shell.tsx:86-104, signOut with the deprecated callbackUrl).

I signed in as maya and measured the open menu at / (1280 light): panel radius 16px, padding 4px, width 288; label 'Good afternoonMaya Example' at weight 500; radio items 44px tall, weight 400, radius 7.2px; menu items at weight 400; Help target=_blank. Screenshots are in scratchpad/shots/audit2/sys15: menu-1280-light.png, menu-1280-dark.png, menu-375-light.png, and cmp-light.png / cmp-dark.png beside preview_V2Home_menu_html-1280-light.png.

The approved V2Home-menu (the V2Overview-menu and ADOverview-menu mockups are the same) has:
- a 40px avatar beside the name at 600 and a caption 'Duty manager · LeisureWorld';
- an 'Appearance' caption at 600 over a pill segmented bar (System, Light, Dark);
- then only Manage account and Sign out, as .mi items: 44px, pill, weight 600;
- a 320px menu with 16px padding, 16px gap and 24px radius, with no separators.

The direction of the change is right, but three details move away from the mockup or contradict DESIGN.md:
1. 'Neutral' avatar is wrong. The mockup uses `.avatar.me`, which is --psoft #e9f0fd/#17284a with ink #174ea8/#a8c5ff. Those are exactly --pc-primary-soft and --pc-primary-ink (poolside.css:27,29). The existing `Avatar` in src/components/docs/ui.tsx:52-70 already wraps the shadcn Avatar with bg-ui-brand-soft / text-ui-brand-ink, and the bar trigger already uses it. Reuse it at 40px; don't add a neutral one.
2. Keeping Help in the menu fails the change's own acceptance test ('matches V2Home-menu side by side'). No approved menu mockup has a Help item. In the mockups Help is a rail item (`railbtn` Help), and the live app already has it in the rail (module-shell.tsx:156) and in the phone bottom bar's More (module-shell.tsx:187). The deck mockup and DESIGN.md:92 put deck Help in the deck's top bar, and instructor-shell.tsx:83 already does. So a menu Help would be a duplicate. A helpHref prop would only exist to support that duplicate.
3. 'Help opens in the same tab' contradicts DESIGN.md:294 ('The module rail and the account menu open Help in a new tab'). It would also make the menu's Help behave differently from the rail's Help.

The rest checks out:
- Role and site can come from the root layout, which already calls auth(). session.user.roleName exists, and getCurrentClub() is cached.
- switchClub calls revalidatePath('/', 'layout'), so the caption follows a site change.
- Deleting the sidebar variant leaves dead code to remove: greeting() (only used here) and the .workspace-account CSS.
- KEEP: The change is sound overall, but five parts of it would cause regressions as written. Each one can be fixed by amending the instructions.

(1) Putting the shared ThemeToggle inside the menu breaks keyboard access. ThemeToggle (src/components/theme-toggle.tsx:25-50) is a Radix RadioGroup, and you reach it with Tab. Radix menu content cancels Tab (node_modules/@radix-ui/react-menu/dist/index.mjs:313, v2.1.24). Arrow keys only move between menu items. So inside DropdownMenuContent the System/Light/Dark control could not be reached from the keyboard. It would also put non-menuitem children inside role=menu. Today's DropdownMenuRadioItem rows (account-menu.tsx:41-45) do work from the keyboard.

(2) Opening Help in the same tab goes against the documented rule. DESIGN.md:294 and docs/help-centre.md:5 say Help opens in a new tab "so an in-progress form stays open". The rail Help and the bottom-bar Help (module-shell.tsx:156, :187) and the deck's Help icon (instructor-shell.tsx:83) would still open a new tab. Refunds, Training, HR and Rota forms have no draft persistence and no unload guard (grep finds no localStorage or beforeunload in src/components/{refunds,training,hr,rota}). So filling in src/components/refunds/request-form.tsx and choosing Help from the menu would throw away what was typed.

(3) Some of the trigger moves to the shadcn Avatar, but account-menu.tsx:9 still imports Avatar from '@/components/docs/ui', which is a Work module. Once the deck (Activities) imports AccountMenu, Activities depends on Docs through it. Lint does not catch this because the rule only checks direct imports. The trigger avatar must change as well.

(4) Changing the YourModules context (your-modules.tsx:12-21) affects these:
- useYourModules: ModuleRail and ModuleBottomBar in module-shell.tsx:146,165.
- Several preview fixtures render InstructorShell or AppShell without the provider: scripts/help-screenshots/fixture.jsx:52, scripts/instructor-swimmer-preview/fixture.jsx:62, scripts/move-readiness-preview/fixture.jsx:58, scripts/instructor-swimmer-preview/assessment-fixture.jsx:52. Empty defaults must render cleanly.
- getCurrentClub() (src/lib/clubs/current.ts:22) throws when no club exists, so the root layout must guard it the same way currentSiteForSession does in auth.ts:144-146. It costs no extra query because auth() has already called it inside the same React cache. The site caption stays current because switchClub calls revalidatePath('/', 'layout') (src/lib/clubs/actions/clubs.ts:39).

(5) Several things outside the three listed files break:
- module-shell.tsx:83 passes variant="bar", which no longer type-checks once the variant prop is removed.
- The deck trigger label changes from 'Instructor menu: …' to 'Account menu: …', which breaks the click in scripts/help-screenshots/capture.mjs:23. The help screenshot assets/help/instructor-menu.png and its manifest entry go stale.
- greeting() is used only by account-menu.tsx, so src/lib/greeting.ts and its test become dead.
- The .workspace-account* rules (poolside.css:229-233) only served the sidebar variant.
- poolside.css:366-367 are unlayered, so they beat Tailwind utilities (globals.css imports Tailwind into layers). A Tailwind rounded-[24px] on DropdownMenuContent would be ignored. Changing line 366 itself would restyle every select, popover and dropdown, including ClubSwitcher and the More menus.

Also, the approved V2Home-menu uses .avatar.me, which is primary-soft #e9f0fd with primary ink. That equals --pc-primary-soft and bg-ui-brand-soft text-ui-brand-ink. It is not neutral. A neutral header avatar would not match the mockup or the trigger avatar.

Instructor import boundaries are fine. Activities already imports src/components/workspace (src/modules/activities/components/app-nav.tsx:6), and lint does not restrict workspace. Permissions don't change: the deck hides Manage account through showManageAccount, as docs/instructor.md:40 describes.