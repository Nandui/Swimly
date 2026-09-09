# Redesign prototype

Mode: Operate. This separate app implements the blue-and-soft-amber direction
approved in the interview on 8 September 2026. The production Astryx rules do
not govern this prototype. Production migration waits for prototype review.

The current preview uses shadcn/ui's Vega style with Base UI, requested on
9 September 2026. Official component source lives in `src/components/ui/`;
`src/components/ui.tsx` maps the screen's action and status names to that kit.
Use its Button, NativeSelect, Input, Textarea, Badge, Avatar, Tabs, Dialog,
Card, Alert, Empty, Progress and ToggleGroup components. Keep standalone
workspace surfaces in Cards and data in rows.

Use the semantic tokens in `src/app/globals.css`. Figtree is self-hosted. Blue
identifies primary actions; soft amber adds warmth to neutral surfaces.
Warnings, success and errors have separate token pairs. Light and dark follow
the device until explicitly changed; the dark class stays in sync with that
choice for shadcn's state styles. The app adapters and the shared-control section
in the stylesheet own intentional kit customisations; do not accumulate page-
specific overrides. CSS is grouped by foundations, shared controls, shell,
Reception, Poolside, forms and responsive behaviour.

The deliberate kit adaptations are 44px default control targets, 48px poolside
marking controls with 16px labels, accessible text/field contrast, and the app's
blue/amber palette. Use a four-point spacing rhythm: 8/12px within groups,
16/20px between related items, and 24/32px between sections. Shared panel
insets are 24px on desktop, 20px on smaller desktops and 16px on mobile.
Body text is 14px, supporting details 13px, and compact status labels 12px.
Tabs and marking groups use quiet neutral tracks with raised selected states;
semantic marks add colour. Cards separate workspaces, not every row.
`components.json` points future CLI additions at this isolated app. Its
`@prototype/*` import alias resolves only to this app's source.

Reception is a connected swimmer/timetable workspace. Today opens a persistent
class workspace with attendance and two views of competency marks. Autosave is
explicitly distinct from completion: only Done taking attendance completes it.

The demo data, staff, contacts, results and audit entries are fictional. No
production imports, database connection, authentication or network mutations.
Preview controls live above the product, not among staff tasks. Mock server
storage and local drafts use separate browser keys, so reconnect and revision
conflicts can be exercised without claiming a real server saved anything.

All controls have visible focus, keyboard access, reduced motion support and
44px minimum targets. Test 375, 768, 1024 and 1280px in both modes. Keep body
text at least 14px on desktop and 16px in poolside controls.
