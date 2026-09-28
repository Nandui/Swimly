# Handover: simplifying Turnfin (28 September 2026, late)

For Fernando. Everything is on the local branch **`simplify`**, taken from `dev`
(f44be0a). It is **not pushed** and not on `main`; production is unchanged.

## 1. What Turnfin is now

The five sentences and the nine pillars are in
[how-turnfin-works.md](how-turnfin-works.md); the interactive version is at
https://claude.ai/artifact/95xd15vj8EHsiubRk8nVYT.

1. **Modules**: Swim school, Refunds, Docs, Training, Rota, HR and Admin, each described once in `src/modules/registry.ts`.
2. **A role is a job with one level for each module.** Each person holds one role plus the sites they work at.
3. **You sign in to your role's home page** (for example Front of House), with one card for each module.
4. **Things can be aimed at roles** (Docs reading, Training courses).
5. **Your own things are in Turnfin Me.**

## 2. What changed, step by step

| Commit | Step |
| --- | --- |
| af432b6 | How Turnfin works written down; the separate Activities database paused |
| bb7a667 | Every module describes its levels (`src/modules/registry.ts`, `src/lib/staff/levels.ts`) |
| 5006242 | Roles store levels (additive migration `20261003120000_role_levels`), sessions built from levels, the role converter script |
| fd7bdde | The new role editor (one row for each module) and "Works at" on the person page |
| 1e0f02e | One app again: `apps/activities` folded back into `src/app` |
| 404770c | The home page is the role's workspace; Reception Portal and `/modules` retired |
| 5225543 | The activity log names each entry's module (additive migration `20261004120000_audit_module`) and filters by it |
| 8dd59a6 | Documents and training aimed at roles |
| 6810324 | One role each: extra scoped roles are no longer read |
| (this) | Docs brought up to date |

**Nothing about security was rewritten.** Pages and actions still ask for the
same named permissions; levels are translated into them. The one behaviour
kept on purpose: **Admin: Manage** is still "everything except HR", as
administrators were before.

## 3. Checks

- Typecheck and lint clean; **520/520 tests pass**. New tests cover:
  - levels and module descriptions;
  - the converter against a real in-memory database;
  - the role editor's actions;
  - sessions built from levels;
  - home cards;
  - the audit module map;
  - roles as Docs teams.
- The sandbox (`npm run sandbox`) was used to check:
  - the Roles page and editor, including saving a role, the Staff page and Works at;
  - every page returning from one app;
  - the Receptionist, Swim school manager and Admin home pages (desktop dark, phone light);
  - the Activity filter;
  - roles appearing as Docs teams.
- **Not clicked through:**
  - the Training "Everyone on <role>" buttons (covered by types only);
  - a full DESIGN.md screen checklist at 768 and 1024 for the home page.

## 4. Decisions waiting for you

1. **Convert the real roles.** After the migrations reach a database, run the
   dry run first:
   `npx tsx scripts/convert-roles-to-levels.ts`
   - It lists each role's proposed levels and anything it would **gain**. It never writes a role that would lose access.
   - Roles that gain wait until `--allow-gains`.
   - Expect **Viewer** (read-only desk) to gain the desk's editing, because there is no read-only level. Decide whether to accept that, move those people to another role, or ask for a "Look up" level.
   - Also expect any role that edits swimmers but only teaches (the old built-in Instructor) to become Desk.
   - The Roles page shows the same proposal, with a warning, when you open an old role.
2. **Merging to `main`** applies these migrations to the production database. All are additive:
   - main database: `people_core`, `parent_change_requests`, `training`, `rota`, `staff_app`, `role_levels`, `audit_module`;
   - Docs database: `002_platform_groups`;
   - HR database: `001_hr`, once HR has its own database.
   Confirm before merging.
3. **Vercel:** the `turnfin-activities` project and the two empty Activities databases are no longer used. You can delete them. Work no longer needs `ACTIVITIES_URL`.
4. **Docs "Restricted" tick** (only a document's audience can open it): recommended, not built. Say if you want it.
5. **Push `simplify` to `dev`?** Not done, waiting for your go-ahead.

## 5. Known follow-ups (not blocking)

- HR and Docs keep their own logs in their own databases; they don't yet also write a one-line entry to the shared activity log.
- The Docs shell pieces borrowed by Refunds, Training, HR and Rota should move to `src/components/workspace`.
- Swim school, Docs and Refunds pages keep their own frames with a "Home" link. Only the home page, Admin, Training, HR and Rota use the shared frame. Moving all modules into one frame is a design pass to mock up first.
- The `RoleAssignment` table and `StaffRole.home` column are unused; drop them in a later, deliberate migration.
- The home Docs card could list "Your documents" (those aimed at your role).

## 6. Running it

`npm run sandbox`, then open http://localhost:3100. Sign in as any of these (the
password is in `scripts/sandbox.mts`):
- alex (Admin);
- maya (Duty manager at Churchfield);
- liam (Swim school manager);
- ava (Instructor);
- noah (Receptionist);
- riley (Lifeguard).
