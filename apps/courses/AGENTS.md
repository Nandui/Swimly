# Turnfin Courses

Turnfin Courses is the standalone app at `courses.turnfin.app`: swim classes, the pool deck, short courses and Academy courses ([D34](../../docs/decisions.md)). Read [../../docs/courses.md](../../docs/courses.md) first: what it shares with Turnfin, its data, accounts and grants, and the order of the work. Read the Next.js guide in `node_modules/next/dist/docs/` before writing code: this version differs from older ones.

Turnfin's rulebook ([../../AGENTS.md](../../AGENTS.md)) does **not** bind this app, except its working agreement (what needs the owner's yes), "Data in examples" and "Secrets". The rules here are few.

## Standalone

- Import nothing from `../../src`. Lint refuses it.
- The database is reached only through `src/data/db.ts`. Courses queries its own tables (`courses.prisma`, `activities*.prisma`, `academy.prisma`) and reads `clubs`, `users` and `staff_roles` (staff keep their Turnfin accounts and roles) and `audit_logs` (the history of course records from before Courses kept its own log). Lint refuses any other table, and any write to those four, except adding a row to `audit_logs` for a change made here ([courses.md](../../docs/courses.md#sign-in-and-access), the log).
- Schema changes go in `../../prisma/schema` with a migration in `../../prisma/migrations`, and **only add**. Courses never runs migrations.

## Folders

| Folder | Holds |
| --- | --- |
| `src/app` | routes: thin pages and layouts |
| `src/access` | Continue with Turnfin (the pass), sessions, grants worked out from roles |
| `src/data` | the database client, the log, dates in `Europe/Dublin` |
| `src/frame` | the frame every signed-in page uses, the search field, links to pages still in Turnfin |
| `src/home`, `src/place` | the desk's home and its search; the waiting queue and placing a swimmer |
| `src/<area>` | one area of work (desk, deck, courses and so on): its reads, writes, rules, screens and tests together |

## Writes

A write authorises (a grant, at a site), validates, guards, writes and logs, with the write and its `courses_log` row in one transaction. A write to a table Turnfin's code also writes keeps Turnfin's guards, in Turnfin's order, with its locks (`src/place/actions.ts` is the worked example): read the Turnfin action first, and refuse here whatever it would stop to ask about. Errors a person can fix are return values (`{ ok: false, error }`); throwing is for "this should not have been possible". Deactivate, never delete.

## Access

- Every page and action calls `requireAccount()` or `requireGrant(...)` itself. Menus and hidden buttons are never security.
- Code asks for a grant (`src/access/grants.ts`), never a job title, a role name or a Turnfin level. A new grant is added there with the level that gives it.
- No raw rows reach the browser: select the fields a screen needs.
- The rules that protect swimmers' data ([../../docs/apps.md](../../docs/apps.md#rules-that-protect-people)) hold here.

## Screens

The look is Turnfin Sheet ([../../DESIGN.md](../../DESIGN.md): its tokens, type, radii, states and accessibility rules) with Courses' own layout, approved from mockups on 27 November 2026 ([../../docs/courses.md](../../docs/courses.md#the-design)).

- One stylesheet, `src/app/sheet.css`: every colour is a token named there, with its dark value. Nothing else writes a colour.
- Every signed-in page is a `Frame` (`src/frame/frame.tsx`): the top bar and the page's header on the blue ground, its work on the white sheet. The top bar lists only pages that exist.
- A page leads with what the person does there. The desk's home is the search and one tile per job, each a number and a plain verb: no lists, tags or second column beside them. When a screen feels busy, change its structure; do not add detail.
- Colour means something: orange needs action now, green is done, red is serious. Always with a word.
- 44px targets, a whole tile or row as the target, visible focus, and every state said in words: loading, empty, failed, saved.
- A new screen is confirmed as a mockup first, and seen in the running app at phone, tablet and desktop widths, light and dark, before it is shown.
- Until Courses has its own page for a job, the job opens in Turnfin (`src/frame/turnfin.ts`), on the same records.

## Checks

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, from this folder. Tests use synthetic names only.
