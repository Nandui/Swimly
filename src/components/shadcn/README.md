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
  TableHead is 600 (`font-semibold`), never the browser's 700.
- ItemTitle is the row name (14px/600) and ItemDescription its caption (12px,
  muted, no line clamp), matching the v2 row; use the pair instead of ad hoc divs.
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
- RadioGroupItem with no children is the 20px dot radio (Checkbox is the
  matching 20px box, no shadow). With children it drops all dot geometry and
  decoration so `SegmentedChoice` (`src/components/ui-kit/segmented-links.tsx`)
  can style it as a `.pc-seg-item`; that is the only place to pass children.
  Radix still provides the keyboard behaviour, group semantics and checked
  state. Tabs has one variant (the soft pill bar); the underline `line`
  variant is gone.

The booking sheet composes Table, Item, Tabs, Select, Command/Popover, Badge
and Empty. Custom CSS expresses its time/level geometry and sticky headers.
Lucide supplies icons; headings and text use semantic HTML.

The source audit and conversion record is in
[docs/shadcn-audit.md](../../../docs/shadcn-audit.md). `npm run lint` rejects
visible native controls, custom interactive roles and competing UI libraries
outside this directory. Hidden inputs used by form compositions remain native.
When collapsing a form section, keep its content mounted and hide the closed
state so entered values still reach FormData and survive reopening.
