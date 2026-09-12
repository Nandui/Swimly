# Swimly shadcn components

Installed from shadcn/ui's MIT-licensed `new-york` registry with the CLI.
`components.json` points to this directory; `components/ui` still contains
Astryx form adapters used by other screens.

Local adaptations:

- Semantic colour and radius utilities have a `ui-` namespace, backed by
  `src/app/shadcn.css`, to avoid changing legacy Astryx utilities. Apply the
  same namespace to newly installed or updated components.
- `cn` uses the app's existing `@/lib/utils` helper.
- Table accepts `containerClassName` so Today can own one scroll region.
- CommandDialog keeps its accessible title inside DialogContent and forwards
  `shouldFilter` for server-filtered swimmer search.
- Sonner uses the existing cookie-backed theme context and shadcn tokens.
- Sidebar leaves persistence to Swimly's existing collapse cookie. Its
  skeleton width is deterministic; the mobile hook uses useSyncExternalStore.
- Touch sizes and visible focus are enforced in `shadcn.css`.
- RadioGroupItem accepts custom children for the Instructor's labelled,
  segmented attendance and competency choices. Radix still provides the
  keyboard behaviour, group semantics and checked state.

The booking sheet composes Table, Item, Tabs, Select, Command/Popover, Badge
and Empty. Custom CSS expresses its time/level geometry and sticky headers.
Lucide supplies icons; headings and text use semantic HTML.
