<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Swimly

Who Swimly is for, what it must get right and what is deliberately undecided
live in [PRODUCT.md](PRODUCT.md). Read it before changing what a screen does;
read the design files below before changing how it looks.

The design authority is the **ui-ux-pro-max** skill and the system it
generated for this project: [design-system/swimly/MASTER.md](design-system/swimly/MASTER.md),
with page overrides in `design-system/swimly/pages/`. Read MASTER.md before
adding a page, a table, a form or an action. When it does not answer a visual
or interaction question, ask the skill — one intent per query:

```bash
python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<2-5 words>" --domain <ux|style|typography|color|icons|chart>
python ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<2-5 words>" --stack <nextjs|shadcn|html-tailwind>
```

[DESIGN.md](DESIGN.md) records how MASTER.md was mapped onto shadcn's tokens
(and the two places the generated palette failed its own contrast bar), plus
the architectural decisions that still stand: server actions returning a
result type, permissions asked by name, audit on every mutation, the seat lock.
The former visual doctrine — "the well-kept page", vendored at
`.claude/skills/design-kit` — is superseded; its components in
`src/components/ui-kit/` remain in use, its rules do not.

The four that get broken first: ask for a **permission**, never a role name;
every mutation writes an **audit row**; status colour only through the **tag
tokens** via a metadata map, never a colour at a call site; and run the skill's
**pre-delivery checklist** before calling a screen done — 4.5:1 text contrast
in both modes, visible focus, `prefers-reduced-motion` respected, pointer
cursors, 375px checked.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.
