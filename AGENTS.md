<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Swimly

Read [DESIGN.md](DESIGN.md) before adding a page, a table, a form or an action.
It records the decisions this repo has already taken; the system it applies is
vendored at `.claude/skills/design-kit` (also a Claude Code skill — ask for
"the house style") and its references are the authority on anything DESIGN.md
does not answer.

The four that get broken first: no KPI cards or stat tiles, one blue for
interaction only, status colour only from the nine tint pairs via a metadata
map, and every mutation writes an audit row.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.
