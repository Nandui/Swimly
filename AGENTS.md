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

The app uses owned shadcn components on Base UI, with Figtree, warm neutral
surfaces, blue actions and soft amber highlights. Read [DESIGN.md](DESIGN.md)
before changing the visual system. Shared primitives live in
`src/components/primitives`; reusable compositions in `src/components/workspace`.
Keep styling in semantic tokens, accessible primitives and maintainable layouts.

Ask for a permission by name, never a role name. Every mutation writes an audit
row in the same transaction. Keep enrolment capacity decisions under the seat
lock. Status colours come from metadata maps. Check both themes, keyboard focus,
44px touch targets and widths 375, 768, 1024 and 1280 before calling a screen done.
The shell owns the main landmark and page width; do not nest another shell.

Staging runs the main application from `codex/staging-redesign`. It uses the
existing database by explicit user choice, so staging edits affect live records.
It requires normal authentication. The isolated fictional prototype remains in
`prototypes/redesign`; never import its data adapter into the main application.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.

Development and production share a database: schema changes must be additive.
For user-authorized record management, use `npm run db:check` and the secured
command-line workflow in [docs/database-operations.md](docs/database-operations.md).
The local credential is in ignored `.vercel/swimly-operations.json`. Never print
it, use Computer Use for this workflow, or request a Postgres password when this
connection is available. Existing actions retain permissions and audit logging.
Do not run seeds, imports or database mutations merely to inspect or test the app.
Keep real swimmer names, contacts and medical information out of exported
artifacts and screenshots; use synthetic examples for design work.
