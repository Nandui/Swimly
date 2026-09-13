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

The entire app uses shadcn/ui components from src/components/shadcn, with
Neutral light/dark tokens and Figtree. The owner approved full conversion.
Read installed component source before use. Use semantic HTML and Tailwind for
layout, ui- colour/radius utilities from src/app/shadcn.css, and metadata-fed
Badge/Tag tones. Shared form compositions in src/components/ui preserve native
FormData, validation and reset behaviour. See DESIGN.md for the full contract.

Instructor is an isolated pool-deck workspace under `(instructor)/instructor`,
fully migrated to shadcn, including its class list, start confirmation,
attendance, competencies and completion dialogs. Its controls are tablet-sized.
Every class requires a confirmed start for that date; only the claiming
instructor may open it or save teaching records. Preserve the server checks
and atomic claim. Do not add desk navigation,
global swimmer search or profile links to it, or Instructor links to desk
navigation. Shared teaching components must preserve the route-selected
workspace boundary. See [docs/instructor.md](docs/instructor.md).

The core rules: ask for a named permission, never a role; every mutation
writes an audit row; status tones come through metadata maps; and run the
screen checklist in DESIGN.md before finishing. Preserve one H1, visible
focus, 44px touch targets, both modes and layouts at 375, 768, 1024 and 1280.
The shell owns the main landmark and 16px inset; do not nest a page frame.

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
