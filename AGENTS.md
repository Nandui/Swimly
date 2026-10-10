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

Add a plain-language entry to [CHANGELOG.md](CHANGELOG.md) for any change staff will
notice, and bump `version` in package.json to match.

For code changes, run `npm run typecheck` and `npm run lint`, plus focused checks
for the behaviour changed. Apply DESIGN.md's screen checklist to screen changes.
For instruction-only edits, validate instructions, links and diffs instead of
building the app. Broaden or repeat checks only for a new change, failure or
unresolved concern. Say which checks actually ran.

## Project constraints

Turnfin is one app: **modules** (Swim school, Pool deck, Tasks, Refunds, Docs, Training, Rota, Purchasing, Academy, HR and Admin) on
a shared **Core** (people, roles, sites, audit, the module catalogue), plus Turnfin Me
(`apps/me`) and the public Academy booking site (`apps/academy`, docs/academy.md). See [docs/how-turnfin-works.md](docs/how-turnfin-works.md) and the owner's
pillars in it (28 September 2026): simplicity, ease of use, modern, scalable, clean code,
easy to manage, audit and train, and change without breaking. Each module describes
itself in its `manifest.ts` (listed in `src/app/modules.ts`), including its levels; a role holds one level for each
module. The swim school (Activities) lives in `src/modules/activities`,
`src/app/(activities)` and `src/app/(instructor)`. Core never imports a module, and
Activities never imports a Work module or queries Core tables (use `src/lib/directory.ts`).
Cross-module needs go through `src/modules/contributions.ts`, the session hooks or a
composition root. Every screen is listed in exactly one of
`CORE_SCREENS`, `ACTIVITIES_SCREENS` or `WORK_MODULE_SCREENS`. `npm run lint` enforces the imports and data rules; see
[docs/architecture.md](docs/architecture.md).

Who Swimly is for, what it must get right and what is deliberately undecided
live in [PRODUCT.md](PRODUCT.md). Read it before changing what a screen does;
read the design files below before changing how it looks.

The entire staff app uses shadcn/ui components from src/components/shadcn.
The **whole app** uses Poolside Clear v2 (Plus Jakarta Sans, the fin's blue, pill controls,
white borderless panels of separate rows; owner decisions, 27 September and 3 October 2026). Its tokens and system rules are in
`src/app/theme/poolside.css`, scoped to `.turnfin-app` on `<body>` by the root layout, so
every page and portalled dialog follows it; Docs/Refunds shell rules stay on `.turnfin-docs`.
Refunds adds `.turnfin-refunds`; the people-scoped workspaces (Training, HR, Rota) share
`ModuleShell` and `.turnfin-module` layouts. Never reintroduce a separate module theme. Use its type and control
tokens (`--pc-text-*`, `--pc-control-height`, `--pc-radius-*`), never literal sizes
(see DESIGN.md, docs/turnfin-docs.md and docs/refunds.md). The owner approved
full conversion and the blue accent for actions, selection and focus.
Read installed component source before use. Use semantic HTML and Tailwind for
layout, ui- colour/radius utilities from src/app/shadcn.css, and metadata-fed
Badge/Tag tones. Shared form compositions in src/components/ui preserve native
FormData, validation and reset behaviour. See DESIGN.md for the full contract.

Instructor is an isolated pool-deck workspace under `src/app/(instructor)/instructor`,
fully migrated to shadcn, including its class list, start confirmation,
attendance, competencies and completion dialogs. Its controls are tablet-sized.
Every class requires a confirmed start for that date. Once started, all staff
with Instructor access and the relevant teaching permissions can open and help
with it. Preserve the original atomic start record, audit and save-conflict
checks; starts do not grant exclusive ownership. Do not add desk navigation,
desk profile links or a cross-site swimmer search to it, or Instructor links to desk
navigation. Its only swimmer lookup is `/instructor/swimmers`: swimmers with a current
place at the working site, medical notes only for swimmers the instructor teaches or
covers today (owner decision, September 2026; see src/modules/activities/shared/classification.ts). Shared teaching components must preserve the route-selected
workspace boundary. See [docs/instructor.md](docs/instructor.md).

The core rules: ask for a named permission, never a role; every mutation
writes an audit row; status tones come through metadata maps; and run the
screen checklist in DESIGN.md before finishing. Preserve one H1, visible
focus, 44px touch targets, both modes and layouts at 375, 768, 1024 and 1280.
The frame (`ModuleShell`) owns the main landmark and page inset: 24px around and inside
the rounded frame, none on phones where the frame is the page. The pool deck uses the same
`tf-shell`/`tf-frame` (capped at 1180px, no rail or bottom bar) with the same insets. Do
not nest a page frame.

A role holds **one level for each module** (`StaffRole.levels`), translated into named
permissions by `src/lib/staff/levels.ts`; a screen is a menu entry opened by one permission. Pages and actions ask for a named
permission, never a level or a role name. Each person holds **one role** plus the sites they
work at (`User.siteIds`; none means every site). Swim school, Pool deck, Tasks, Training and Rota apply at
those sites, HR "Their team" only to the people they manage, the rest everywhere. **Admin:
Manage** is the administrator: Manage in every module except HR (restricted); resolve it
through expandPermissions and visibleScreens. A **superadmin** (the `User.isSuperadmin` flag,
never a permission) holds everything; only a superadmin makes another, and only a superadmin
gives HR. Role previews only remove access. `RoleAssignment` (extra scoped roles) is retired
and no longer read. Code that reads people's records (training, HR, reports) must use the
policy engine in `src/lib/policy` (`requireCapFor`, `subjectsFor`, `sitesFor`) with a
resource, never the flat check. Home pages, cards and nav hiding are presentation, not
security. See docs/how-turnfin-works.md and docs/platform-access.md.

Work and Me are separate (owner decision, 27 September 2026): Turnfin Work (this app) is the
job on registered work PCs and must never gain personal pages or endpoints; a person's own
training, required reading, qualifications, shifts, HR and details belong to Turnfin Me
(`apps/me`), which only calls `/api/staff/v1` with allowlisted responses. Signing in to Work away
from a registered device needs `work.anywhere` when `WORK_DEVICE_REQUIRED` is on. See
docs/staff-app.md.

Prisma here is v7: the client is generated into `src/generated/prisma` and
needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in
`prisma.config.ts` rather than in the schema.

Branch and PR previews use their own development database (`DATABASE_ENVIRONMENT=development`) and
apply main-database migrations to it, never to production; Docs and HR migrations run only in
production (docs/database-operations.md). Schema changes must still be additive, because merging
to `main` migrates production under live code; test them in the local sandbox (`npm run sandbox`). Docs uses its own `DOCS_DATABASE_URL` / `DOCS_DIRECT_URL` and schema
migrations in `docs-database`; shared staff login/grants still come from Turnfin.
Never repoint the main `DATABASE_URL` or fall back to it for Docs content. HR and
performance likewise use their own `HR_DATABASE_URL` / `HR_DIRECT_URL` and
`hr-database/migrations` (docs/hr.md); unset, HR stays switched off.
For user-authorized record management, use `npm run db:check` and the secured
command-line workflow in [docs/database-operations.md](docs/database-operations.md).
The local credential is in ignored `.vercel/swimly-operations.json`. Never print
it, use Computer Use for this workflow, or request a Postgres password when this
connection is available. Existing actions retain permissions and audit logging.
Do not run seeds, imports or database mutations merely to inspect or test the app.
Keep real swimmer names, contacts and medical information out of exported
artifacts and screenshots; use synthetic examples for design work.
