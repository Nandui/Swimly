# Turnfin Courses

Turnfin Courses is the standalone app at `courses.turnfin.app`: swim classes, the pool deck, short courses and Academy courses ([D34](../../docs/decisions.md)). Read [../../docs/courses.md](../../docs/courses.md) first: what it shares with Turnfin, its data, accounts and grants, and the order of the work. Read the Next.js guide in `node_modules/next/dist/docs/` before writing code: this version differs from older ones.

Turnfin's rulebook ([../../AGENTS.md](../../AGENTS.md)) does **not** bind this app, except its working agreement (what needs the owner's yes), "Data in examples" and "Secrets". The rules here are few.

## Standalone

- Import nothing from `../../src`. Lint refuses it.
- The database is reached only through `src/data/db.ts`. Courses queries its own tables (`courses.prisma`, `activities*.prisma`, `academy.prisma`) and reads `clubs` and `users` for names. Lint refuses any other table, and any write to those two.
- Schema changes go in `../../prisma/schema` with a migration in `../../prisma/migrations`, and **only add**. Courses never runs migrations.

## Folders

| Folder | Holds |
| --- | --- |
| `src/app` | routes: thin pages and layouts |
| `src/access` | accounts, sign-in, sessions, grants |
| `src/data` | the database client, the log, dates in `Europe/Dublin` |
| `src/<area>` | one area of work (desk, deck, courses and so on): its reads, writes, rules, screens and tests together |
| `scripts` | operator scripts: dry-run until `--confirm`, logged |

## Writes

A write authorises (a grant, at a site), validates, guards, writes and logs, with the write and its `courses_log` row in one transaction. Errors a person can fix are return values (`{ ok: false, error }`); throwing is for "this should not have been possible". Deactivate, never delete.

## Access

- Every page and action calls `requireAccount()` or `requireGrant(...)` itself. Menus and hidden buttons are never security.
- Code asks for a grant (`src/access/grants.ts`), never a job title.
- No raw rows reach the browser: select the fields a screen needs.
- The rules that protect swimmers' data ([../../docs/apps.md](../../docs/apps.md#rules-that-protect-people)) hold here.

## Screens

The design is not chosen yet (courses.md, step 2). Until it is approved from mockups, screens are plain HTML with the one stylesheet `src/app/plain.css`: add no colours, fonts or components to it.

## Checks

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, from this folder. Tests use synthetic names only.
