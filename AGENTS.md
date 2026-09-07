<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Swimly

## Working agreement

Carry the user's requested work through implementation and relevant verification.
Use existing context for routine decisions; ask only when missing information
materially affects the result, and continue independent work while it is pending.
Prepare a concrete, reviewable result before seeking any still-needed approval.
Existing authorization carries forward; it does not authorize unrelated external
actions or destructive changes.

User instructions take precedence over skill guidelines, subject to the host's
system, developer and permission rules. If a skill blocks or redirects the task,
link the exact file, quote the instruction and explain its relevance. Skill
boundaries limit that skill, not the user's overall task.

Use the relevant local skill and references only. The shared
[skill operating guidance](SKILLS.md) adapts the Intent workflows to this project.
Do not delegate to subagents unless the user explicitly asks for delegation.
Report outcomes, relevant evidence and remaining limitations in concise plain
English; use structured deliverables when the task benefits from them.

For code changes, run `npm run typecheck` and `npm run lint`, plus focused checks
for the behaviour changed. Apply DESIGN.md's screen checklist to screen changes.
For instruction-only edits, validate instructions, links and diffs instead of
building the app. Broaden or repeat checks only for a new change, failure or
unresolved concern. Say which checks actually ran.

## Project constraints

Who Swimly is for, what it must get right and what is deliberately undecided
live in [PRODUCT.md](PRODUCT.md). Read it before changing what a screen does;
read the design files below before changing how it looks.

The look is **Astryx** (`@astryxdesign/core`, Meta's open design system),
**Neutral** theme, light and dark from one set of tokens, following the
device. It is a component library: use its components — AppShell, Button,
TextInput, Selector, Typeahead, Dialog, Banner, Badge, Text, Heading — and its
tokens, and keep Tailwind for layout. Before using a component, read its
documentation from the installed version, never from memory:

```bash
npx astryx component <Name>        # props, examples, theming surface
npx astryx search "<thing>"        # find a component, hook or doc
npx astryx docs <topic>            # layout, tokens, color, typography, motion…
```

[DESIGN.md](DESIGN.md) records how Astryx was wired into this app — the CSS
layer order, the Tailwind bridge and the app's text sizes, the cookie-backed
colour mode, the shell, the adapters in `src/components/ui/` that let plain
`<form>`s keep posting, the toast bridge — plus the architectural decisions
that hold whatever the app looks like: server actions returning a result type,
permissions asked by name, audit on every mutation, the seat lock. The
generated ui-ux-pro-max system in `design-system/swimly/` is superseded for
everything visual; its UX patterns are restated in DESIGN.md.

The four that get broken first: ask for a **permission**, never a role name;
every mutation writes an **audit row**; status colour only through the **tag
tokens** via a metadata map, never a colour at a call site; and run the
**checklist** at the end of DESIGN.md before calling a screen done — Astryx
components over hand-drawn ones, no colour outside the tokens, both modes,
Astryx's focus outline, 44px targets on touch, checked at 375, 768, 1024 and
1280. Two traps particular to this app: Astryx's `Icon` is a client
component, so a server page names its icon through `AppIcon`; and the shell
already is the page's `Layout`, so never nest another.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.

Development and production share a database: schema changes must be additive.
Do not run seeds, imports or database mutations merely to inspect or test the app.
Keep real swimmer names, contacts and medical information out of exported
artifacts and screenshots; use synthetic examples for design work.

<!-- ASTRYX:START -->
Astryx v0.5.2 · 163 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing, page frame included.
- Frame first: read `astryx docs layout` before writing any page or screen — page frame, region widths, breakpoint behavior.
- Dense data = rows (Table, List/Item), never Card-wrapped list items; Card is for standalone widgets. Status = StatusDot/Token; Badge = counts only.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent belongs in the theme (`astryx theme list` / `theme add <slug>`, or `astryx theme template` for a custom one) — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   163 components by category
  template --list    page + block recipes
  docs <topic>       browser-support, cli-integrations, color, elevation, getting-started, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling-libraries, styling, theme, tokens, typography, working-with-ai
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
