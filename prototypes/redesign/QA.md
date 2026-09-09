# Prototype verification

All records used in these checks and screenshots are fictional.

## Coordinated UI polish — 9 September 2026

Reorganised the shared styles around consistent spacing and panel insets,
readable supporting text, quieter selected states, and responsive composition.
Today now shows the next class's attendance state and care-note count. Removed
decorative shell copy and reduced the large gaps between related controls.
Reception, Today, attendance, competencies and booking dialogs were reviewed.
Draft, persistence and production code were not changed.

- Prototype typecheck, lint and isolated build passed. The build was repeated
  after the final shared-button and focus fixes and passed.
- Production typecheck and lint passed. No production build or database command
  was run.
- Nine existing workflow tests and eight viewport/theme tests passed, covering
  all four specified widths, touch targets, overflow and default-screen axe checks.
- Additional dialog focus containment, dialog overflow, and axe checks for the
  move form and both competency views passed at every width in both themes.
- The expanded review caught insufficient contrast on the primary button's
  hover state. Its hover now uses the paired semantic colour instead of opacity.
  It also removed duplicated focus outlines and inherited bold textarea text.
- Desktop, tablet and mobile captures were visually inspected. Updated Today
  and dialog captures are prefixed `polish-` in the ignored `captures/` folder.

The state unit tests were not rerun for this visual pass; the browser suite
exercised the existing save and recovery behaviour. These remain Chrome-based
prototype checks, with the integration boundaries below still applying.

## shadcn/ui preview — 9 September 2026

Replaced custom controls with the official shadcn/ui Vega components for Base
UI, keeping the same draft and fictional persistence code. The nine end-to-end
workflow tests passed. All eight layout/accessibility combinations passed after
fixing a legacy link colour rule, and passed again after the final composition
cleanup. They cover 375, 768, 1024 and 1280px in both themes, including 44px
control measurements and both competency views.

Prototype typecheck, lint and isolated build passed. The production app's
typecheck and lint also passed; its build and database workflows were not run.
The state and desk tests listed below were not rerun for this component-only
change. Desktop and mobile screenshots were visually reviewed. The current
captures show the shadcn version.

The earlier prototype's source is preserved locally under the ignored
`captures/before-shadcn/` folder for comparison or restoration. `components.json`
records the installed kit. No production source, API or database changes were
made for this preview.

## Original prototype — 8 September 2026

## Completed checks

| Check | Result |
| --- | --- |
| Production `npm run typecheck` and `npm run lint` | Passed after excluding the independent prototype |
| Prototype TypeScript and ESLint | Passed, no lint warnings |
| Focused state and desk tests | 19 passed |
| Chrome interaction and layout tests | 17 passed |
| Final control-size change | 9 affected browser checks passed again |
| Isolated `next build` | Passed; no database commands |
| Impeccable static design detector | No findings |
| Scoped tracked diff whitespace check | Passed |

The focused tests cover pure, atomic desk commands, failed moves, full classes,
assessment capacity, permissions and club isolation. Draft tests cover no writes
on opening a class, batching, one request in flight, late acknowledgements,
local restoration, temporary failures and automatic retries, storage failures,
revision conflicts, explicit completion and roster changes during a save.

The browser tests exercise search and empty results, enrolment, moving classes,
assessment booking, failed forms retaining values, both competency views,
navigation and reload, slow and offline saves, permission withdrawal during a
save, conflict review, cover declaration and level confirmation. They also check
keyboard tab navigation, dialog focus return and mobile selection/filter retention.

## Visual and accessibility review

Reception, Today and the class workspace were exercised at 375, 768, 1024 and
1280px in light and dark modes. Automated checks found no horizontal overflow
or page errors. Visible controls in these screens and both competency views
were measured at a minimum of 44 by 44px. Poolside marking labels are 16px.

The eight viewport/theme combinations were checked with axe's WCAG 2 A/AA and
2.1 AA rules on the default Reception, Today and attendance screens, with no
reported violations. Keyboard focus, dialog dismissal/return, colour-mode
persistence and reduced-motion styles were checked. This is a Chrome-based
prototype review, not cross-browser or assistive-technology certification.

Screenshots were visually reviewed for hierarchy, readability, spacing, mobile
layout and both themes. Local review captures live under the ignored `captures/`
directory and can be regenerated by the browser suite. Playwright's full-page
mobile captures place the fixed bottom navigation at the original viewport
boundary; the live page scrolls beneath it with bottom spacing for the last row.

## Boundary for review

Production data, APIs, server actions, schema, Astryx components and operational
workflows were not migrated. The prototype's acknowledged fixture store is
browser-local, and its permission controls simulate permissions. Real versioned
saves, persistent attendance completion, per-swimmer curriculum data, audit and
capacity locking remain production integration work after prototype review.

Use [README.md](README.md) for the run commands and review scenarios.
