<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Turnfin: working in this repository

Turnfin is the staff product for LeisureWorld's leisure centres. The repository is named Swimly; that is a working name only. `CLAUDE.md` only points here.

Version 3 is being planned. The rules written for version 2.0 were removed from this file on 28 November 2026 so that they do not steer it; the owner (Fernando) will write the new ones. Until then this file holds only facts about the code as it runs today and the limits that keep live data safe.

## Never without the owner's yes

Delete or overwrite data, rename or drop tables, run migrations or scripts against a real database, force-push, deploy, protect or reconfigure `main`, send emails or messages, or change settings in Vercel, Neon or Google.

## Live data

- Merging to `main` migrates production under live code, so a database change that removes or renames anything waits for the owner's yes.
- Never rename or edit a migration once its branch is pushed.
- Never run seeds, imports or database writes just to inspect or test. Previews migrate only their own development database.
- Keep real swimmer names, contacts and medical notes out of tests, exports, screenshots and artifacts; use synthetic examples.
- Never print or commit `.vercel/swimly-operations.json`, `.env*` values or any token.

## Checks

- `npm run typecheck`, `npm run lint` and `npm test`. Every pull request to `main` runs these and a build (`.github/workflows/check.yml`). `main` is unprotected, so nothing stops a merge that fails: run them before every push.
- `src/lib/whats-new.test.ts` checks the shape of `CHANGELOG.md`, which staff read at `/whats-new`, and that its newest version matches `package.json`.

## Databases

Prisma 7: the client is generated into `src/generated/prisma` with the `@prisma/adapter-pg` adapter; the datasource is in `prisma.config.ts`; after pulling schema changes run `npx prisma generate`. Docs has its own database; never point it at the main `DATABASE_URL`. HR is the `turnfin_hr` schema in the main database. Record work the owner has authorised uses `npm run db:check` and `npm run db:run`, never a Postgres password and never computer control.
