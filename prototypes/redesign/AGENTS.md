<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Isolated redesign prototype

The approved prototype design in [DESIGN.md](DESIGN.md) is the visual authority
in this directory. Use the installed shadcn/ui components over Base UI; see
`components.json` and `src/components/ui/`. Read [README.md](README.md) for the
architecture and review boundary. Production Astryx rules do not apply here.

Keep all records fictional. Never import production database modules, server
actions or API clients. Run checks from this directory; its build script is
isolated and must not invoke the production build or database workflows.

Preserve the shared draft state across marking views, durable local edits,
revision conflict handling and explicit attendance completion. Run the focused
state tests and browser tests after changing these behaviours. Production
migration remains a separate step after the user reviews this prototype.
