# Turnfin Reception Portal design study

The owner chose option 1, Module directory. To review the implemented components,
run `node scripts/reception-portal-preview/serve.mjs --implementation` and open
`http://127.0.0.1:4200/reception-portal?access=admin`. The preview uses fictional
staff, real component layouts and isolated actions; no live writes occur.
Profiles `access=reception`, `access=read` and `access=docs` check restricted
access. Add `theme=dark`, `site-error` or `signout-error` to inspect those states.

The original three-option design study is retained below.

Implementation verification and the role activation step are recorded in
[`docs/reception-portal.md`](../../docs/reception-portal.md). Completed component
captures are `implemented-desktop.png`, `implemented-mobile.png` and
`implemented-mobile-dark.png` in `.impeccable/review/reception-portal/`.

Run `node scripts/reception-portal-preview/serve.mjs` and open
`http://127.0.0.1:4198/reception-portal`.

Three responsive compositions use the installed shadcn components, Figtree,
Neutral theme and supplied Turnfin logo. All are local design previews with
synthetic data; links show destination explanations and never call live actions.
The site switch and appearance control work in the preview. Choose a layout
with the top controls, or link directly using `?layout=directory`,
`?layout=follow-up` or `?layout=desk`. Add `&theme=dark` for dark mode.

Confirmed: this is the default landing experience for receptionists; other staff
keep the current portal. Aquatics and Docs are existing modules. Bookings stays
Coming soon. The preview shows the full permission-dependent set of shortcuts,
not the current grants of any real role. No access is granted by a portal.

When publishing the implemented composition, configure the reception landing
through its explicit staff-role setting, never a runtime role
name comparison. Preserve the isolated Instructor workspace, the retired
`/reception` redirect, and Aquatics' existing `/start` behaviour. Queue counts
need permission-filtered reads, with accurate scope labels; do not ship the
example counts. The site choice must use the existing device working-site
preference and must not scope shared swimmer identity.

Surface exploration: Impeccable seed `7417f6fb`, established visual world,
Operate mode. Grounded structures ranked before selection:

1. Module launchpad with per-module shortcuts.
2. Reception desk: Aquatics primary, other modules alongside.
3. Task finder: task entry first, modules below.
4. Follow-up queue: outstanding work first, modules alongside.
5. Module rail with selected module tasks.
6. Daily agenda alongside modules.
7. Module directory: stacked module rows with shortcuts.

Dealt structures are 7, 4 and 2, presented in that order. The interactive
prototypes let the owner compare actual component scale and mobile layouts
before choosing. No production routes, roles, database records or defaults
are changed by this study.

## Design study verification (23 September 2026)

- Production-mode preview bundle built successfully.
- `npm run typecheck` and `npm run lint` passed. Focused lint passed after the
  final label/scope edits. The design detector returned no findings.
- All three layouts checked at 375, 768, 1024 and 1280px in light and dark mode:
  no horizontal overflow. Light-mode checks also verified one H1 and no visible
  button below 44px in either dimension.
- Browser checks verified appearance switching, the working-site selector,
  a swimmer shortcut and return to the portal preserving the chosen site.
- Desktop and phone captures are in `.impeccable/review/reception-portal/`.
  Full-page dark capture hit a browser timeout; dark layout checks completed
  in a fresh tab and desktop/phone dark appearance was visually inspected.
- Reviewed locally, without delegated agents, following this project's rules.
  This is a design study; no production authentication, data permissions or
  sign-in routing is claimed as implemented or tested.
