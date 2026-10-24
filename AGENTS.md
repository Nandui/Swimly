<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Turnfin

Turnfin is the staff product for LeisureWorld's leisure centres: a set of **apps** (Swim school, Pool deck, Rota, HR, Refunds and the rest) on a shared **platform**, with **connected products** outside it (Turnfin Me, the parent app, the Academy booking site). This repository is still named Swimly; that is a working name only. The words, and what each means in code, are in [CLAUDE.md](CLAUDE.md) section 1; never use "module", "Turnfin Work", "surface" or "workspace" when talking to staff.

Read before working:
1. [docs/how-turnfin-works.md](docs/how-turnfin-works.md): the model in five sentences, the pillars every decision is judged against, and the levels.
2. [CLAUDE.md](CLAUDE.md): how the code is built. It is the one place for the code rules.
3. [docs/architecture/platform-and-apps.md](docs/architecture/platform-and-apps.md): where Turnfin is going and in what order.
4. [docs/README.md](docs/README.md): every other doc, by topic.

## Working agreement

Carry the requested work through implementation and relevant verification. Use existing context for routine decisions; ask only when missing information materially affects the result, and continue independent work while it is pending. Prepare a concrete, reviewable result before seeking any still-needed approval. Existing authorization carries forward; it does not authorize unrelated external actions or destructive changes.

Judge every proposal against the pillars. Prefer removing a concept to adding one. Give one recommendation, not a menu. Say plainly when existing work, including your own, goes against a pillar.

User instructions take precedence over skill guidelines, subject to the host's system, developer and permission rules. If a skill blocks or redirects the task, link the exact file, quote the instruction and explain its relevance. Use the relevant local skill and references only; [SKILLS.md](SKILLS.md) adapts them to this project. Do not delegate to subagents unless the user explicitly asks for delegation.

Report outcomes, relevant evidence and remaining limitations in concise plain English. Say which checks actually ran.

## Every change

- **Checks.** For code changes run `npm run typecheck`, `npm run lint` and `npm test`, plus focused checks for the behaviour changed, and apply DESIGN.md's screen checklist to screen changes. For instruction-only edits, check the instructions, links and diff instead of building the app.
- **What's new.** Any change staff will notice gets a plain-language entry in [CHANGELOG.md](CHANGELOG.md) and a matching `version` bump in `package.json` and `package-lock.json`. Staff read it on the What's new page (`/whats-new`), so write what they will see or do differently, in their words, with no code, file, database or other technical terms. Keep its shape (`## <version> · <day month year> · <title>`, then `- ` lines); `src/lib/whats-new.test.ts` checks it.
- **Docs.** Update the docs the change touches in the same change. One fact lives in one place; link to it.

## Product rules

- **Access.** A role holds one level for each app; levels become named permissions; pages and actions ask for a permission, never a level or a role name. Code that reads people's records uses the policy engine (`src/lib/policy`) with a resource. Home, menus and hiding are presentation, never security. Only a superadmin gives HR. The full model, including where each level applies, is in [docs/platform-access.md](docs/platform-access.md). Today each person holds one role; "jobs at places" is planned ([docs/architecture/jobs-and-work-layer.md](docs/architecture/jobs-and-work-layer.md)).
- **Audit.** Every change to data writes one audit row.
- **Turnfin and Turnfin Me are separate** (owner decision, 27 September 2026). Turnfin is the job, on registered work computers, and never gains personal pages or endpoints. A person's own training, reading, qualifications, shifts, HR and details belong to Turnfin Me (`apps/me`), which only calls `/api/staff/v1` with allowlisted responses ([docs/staff-app.md](docs/staff-app.md)).
- **The pool deck** is the swim school's poolside app (`src/app/(instructor)/instructor`), tablet-sized, with no desk navigation, desk profile links or cross-site swimmer search, and no links from it to desk pages. Every class needs a confirmed start for that date; once started, anyone with the teaching permissions can help, and starts never give exclusive ownership. Keep the atomic start record, audit and save-conflict checks. Its only swimmer lookup is `/instructor/swimmers`: swimmers with a current place at the working site, with medical notes only for swimmers the instructor teaches or covers today (`src/modules/activities/shared/classification.ts`). See [docs/instructor.md](docs/instructor.md).
- **Screens.** Every screen follows Poolside Clear v2 and the UI rules in [CLAUDE.md](CLAUDE.md) section 13; the design contract and screen checklist are in [DESIGN.md](DESIGN.md). What each screen is for, and for whom, is in [PRODUCT.md](PRODUCT.md): read it before changing what a screen does.

## Databases

- Prisma here is v7: the client is generated into `src/generated/prisma`, needs a driver adapter (`@prisma/adapter-pg`), and the datasource URL lives in `prisma.config.ts`. After pulling schema changes, run `npx prisma generate`.
- Schema changes only add, because merging to `main` migrates production under live code. Test them in the local sandbox (`npm run sandbox`).
- Branch and pull request previews use their own development database (`DATABASE_ENVIRONMENT=development`) and apply main-database migrations to it, never to production. Docs and HR migrations run only in production ([docs/database-operations.md](docs/database-operations.md)).
- Docs has its own database (`DOCS_DATABASE_URL`, `DOCS_DIRECT_URL`, migrations in `docs-database`) and HR has its own (`HR_DATABASE_URL`, `HR_DIRECT_URL`, `hr-database/migrations`; unset, HR stays off). Never point them at the main `DATABASE_URL`. Sign-in and permissions always come from Turnfin.
- For record management the user has authorized, use `npm run db:check` and the secured workflow in [docs/database-operations.md](docs/database-operations.md). The local credential is in the ignored `.vercel/swimly-operations.json`: never print it, never use Computer Use for this workflow, and never ask for a Postgres password while this connection works.
- Never run seeds, imports or database writes just to inspect or test the app. Keep real swimmer names, contacts and medical information out of exports, artifacts and screenshots; use synthetic examples.
