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

The entire staff app uses shadcn/ui components from src/components/shadcn.
Aquatics and the portal use Neutral light/dark surfaces, a logo-blue accent and
Figtree. Docs and Refunds share the Docs repository's Inter and ocean-blue/aqua
theme, scoped to `.turnfin-docs`; Refunds adds `.turnfin-refunds` for its own
layouts (see docs/turnfin-docs.md and docs/refunds.md). The owner approved
full conversion and the blue accent for actions, selection and focus.
Read installed component source before use. Use semantic HTML and Tailwind for
layout, ui- colour/radius utilities from src/app/shadcn.css, and metadata-fed
Badge/Tag tones. Shared form compositions in src/components/ui preserve native
FormData, validation and reset behaviour. See DESIGN.md for the full contract.

Instructor is an isolated pool-deck workspace under `(instructor)/instructor`,
fully migrated to shadcn, including its class list, start confirmation,
attendance, competencies and completion dialogs. Its controls are tablet-sized.
Every class requires a confirmed start for that date. Once started, all staff
with Instructor access and the relevant teaching permissions can open and help
with it. Preserve the original atomic start record, audit and save-conflict
checks; starts do not grant exclusive ownership. Do not add desk navigation,
global swimmer search or profile links to it, or Instructor links to desk
navigation. Shared teaching components must preserve the route-selected
workspace boundary. See [docs/instructor.md](docs/instructor.md).

The core rules: ask for a named permission, never a role; every mutation
writes an audit row; status tones come through metadata maps; and run the
screen checklist in DESIGN.md before finishing. Preserve one H1, visible
focus, 44px touch targets, both modes and layouts at 375, 768, 1024 and 1280.
The shell owns the main landmark and page inset: 16px, increasing to 24px at
1024px in the desk workspace. Instructor keeps 16px. Do not nest a page frame.

Administrators always receive every current and future screen and permission.
Administrator access means both staff.manage and roles.manage; resolve it through
expandPermissions and visibleScreens, never a role name or the legacy enum.
Restricted role grants, role previews and Instructor workspace boundaries still hold.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.

Development and production share the Aquatics database: schema changes must be
additive. Docs uses its own `DOCS_DATABASE_URL` / `DOCS_DIRECT_URL` and schema
migrations in `docs-database`; shared staff login/grants still come from Turnfin.
Never repoint the main `DATABASE_URL` or fall back to it for Docs content.
For user-authorized record management, use `npm run db:check` and the secured
command-line workflow in [docs/database-operations.md](docs/database-operations.md).
The local credential is in ignored `.vercel/swimly-operations.json`. Never print
it, use Computer Use for this workflow, or request a Postgres password when this
connection is available. Existing actions retain permissions and audit logging.
Do not run seeds, imports or database mutations merely to inspect or test the app.
Keep real swimmer names, contacts and medical information out of exported
artifacts and screenshots; use synthetic examples for design work.
