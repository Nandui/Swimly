# Swimly shadcn components

Installed from shadcn/ui's MIT-licensed `new-york` registry with the CLI.
`components.json` points to this directory. `components/ui` composes these
controls with labels, hints and native form submission for shared forms.

Local adaptations:

- Semantic colour and radius utilities have a `ui-` namespace, backed by
  `src/app/shadcn.css`. Apply the same namespace to newly installed or updated
  components. The CLI's `cn` import must resolve to `@/lib/utils`.
- `cn` uses the app's existing `@/lib/utils` helper.
- Table accepts `containerClassName` so Today can own one scroll region.
- CommandDialog keeps its accessible title inside DialogContent and forwards
  `shouldFilter` for server-filtered swimmer search.
- Sonner uses the existing cookie-backed theme context and shadcn tokens.
- Sidebar leaves persistence to Swimly's existing collapse cookie. Its
  skeleton width is deterministic; the mobile hook uses useSyncExternalStore.
- Touch sizes and visible focus are enforced in `shadcn.css`.
- Dialog, AlertDialog, Sheet and Popover accept `portalClassName` for a scoped
  workspace theme. Docs uses this to preserve its source palette in portals.
- Card supports `asChild` for semantic source layouts without adding a nested
  panel. NativeSelect preserves native selection and form submission.
- RadioGroupItem accepts custom children for the Instructor's labelled,
  segmented attendance and competency choices. Radix still provides the
  keyboard behaviour, group semantics and checked state.

The booking sheet composes Table, Item, Tabs, Select, Command/Popover, Badge
and Empty. Custom CSS expresses its time/level geometry and sticky headers.
Lucide supplies icons; headings and text use semantic HTML.

The source audit and conversion record is in
[docs/shadcn-audit.md](../../../docs/shadcn-audit.md). `npm run lint` rejects
visible native controls, custom interactive roles and competing UI libraries
outside this directory. Hidden inputs used by form compositions remain native.
When collapsing a form section, keep its content mounted and hide the closed
state so entered values still reach FormData and survive reopening.
