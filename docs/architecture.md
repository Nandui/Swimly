# Architecture: Core, Work and Activities

Owner decision, 28 September 2026: Turnfin is a shared **Core** with two kinds of product on top.

| Part | What it is | Where it lives |
| --- | --- | --- |
| **Core** | The organisation every module shares: sign-in, people, roles and assignments, sites (`Club`), departments and qualifications, the audit log, the module catalogue and the front door. | `src/app/(core)` (Staff, Roles, Clubs, Activity, Account), `src/lib/{staff,policy,people,clubs,devices,email,audit,directory,...}`, `src/modules/{registry,contributions}.ts` |
| **Work modules** | Running the centre's staff: Docs, Refunds, Training, HR and Rota, plus Turnfin Me (`apps/me`) for each person's own records. Refunds is a desk tool on this side; it can link to a customer but never depends on Activities. | `src/app/{docs,refunds,training,hr,rota}`, `src/lib/<module>`, `src/components/<module>` |
| **Activities** | Running what the centre sells. Swim school is the first activity type: office (curriculum set-up), desk (enrolments, moves, waitlists, assessments), deck (attendance, competencies) and the parent API. Camps, pool hire and fitness classes would join as further types. | **Its own app**, `apps/activities` (routes only), with its code in `src/modules/activities/{lib,components}` |

Work (the repository root app) and Activities (`apps/activities`) are two Next.js apps in one repository. They share one address, one sign-in and, for now, one database.

## The rules

1. **Core never imports a module.** Activities and Work modules import Core; Core does not import them.
2. **Activities depends on Core only**, never on a Work module (Docs, Refunds, Training, HR, Rota).
3. **Cross-module needs go through a seam**, never a direct import:
   - **Contributions** (`src/modules/contributions.ts`): a module registers read-only summaries that Core pages show. Activities adds the Staff page's *Classes* column and each site's *programmes · swimmers · classes* line on Clubs.
   - **Session hooks** (`src/modules/session-hooks.ts`): per-request work a module needs. Activities applies due scheduled unenrolments before any read. `requireSession` loads the hook file lazily.
   - **Self-registration**: shared UI can be extended by a module without knowing it. For example, the swimmer picker declares itself with `labelsItself` from `form-dialog`.
   - **Links**: Work links to Activities screens by URL (`ZoneLink`), never by importing them. The Reception Portal's *Add a swimmer* task opens `/students?add=1`.
4. **Composition roots are the only files that import every module**: `src/modules/server.ts` and `src/modules/session-hooks.ts`.
5. **Screens belong to exactly one part.** `CORE_SCREENS`, `ACTIVITIES_SCREENS` and `WORK_MODULE_SCREENS` in `src/lib/staff/screens.ts` are explicit lists, and a test fails if a screen is not in exactly one of them.
6. **Data belongs to one part.** `prisma/schema/{base,core,work,activities}.prisma` says which part owns each table. Activities never queries Core tables or joins `User`/`Club`: it stores ids and adds names with `src/lib/directory.ts` (`withStaff`, `withSites`, `staffByIds`, `liveSiteIds`, ...). Core and Work never query Activities tables.

`npm run lint` enforces rules 1, 2, 4 and 6 with `no-restricted-imports` and `no-restricted-syntax` (see `eslint.config.mjs`). Tests and `src/test` are exempt, because they exercise routes end to end.

## Two apps, one address (multi-zones)

Staff only ever use Work's address. Work forwards the Activities paths to the Activities app with Next.js rewrites, so the browser never sees a second host and the session cookie is shared.

- **The routing table** is `src/lib/zones.ts`: `ACTIVITIES_PATHS` (`/schedule`, `/students`, `/courses`, ..., `/instructor`, `/api/parent`, `/api/parent-admin`, `/api/curriculum-images`, `/api/operations`) and `ACTIVITIES_ASSET_PREFIX` (`/activities-static`, where the Activities app serves its JavaScript and CSS). A test checks that every route in `apps/activities/src/app` is in the table, and that `apps/activities/next.config.ts` uses the same prefix.
- **Work's `next.config.ts`** rewrites those paths and the asset prefix to `ACTIVITIES_URL`.
- **Links between apps** must be full page loads. `ZoneLink` (`src/components/zone-link.tsx`) renders a plain `<a>` when a link leaves the current app and a Next `Link` otherwise. Deployed builds always differ, and in development each app names its own `deploymentId`, so a soft navigation that lands in the other app also reloads.
- **Server actions** on Activities pages are posted from Work's address, so the Activities app allows `WORK_ORIGIN`.
- **Shared brand images** in `public/` are served by Work. Opening the Activities app directly falls back to `WORK_URL` for `/brand/*`.
- **Both apps** use the same root document (`src/components/root-document.tsx`) and Poolside Clear.

### Environment variables

| Variable | App | Meaning |
| --- | --- | --- |
| `ACTIVITIES_URL` | Work | The Activities deployment, e.g. `https://turnfin-activities.vercel.app`. Required when deployed; `check-env` fails the build without it. Locally `http://localhost:3102`. |
| `WORK_ORIGIN` | Activities | The host staff use for Work, e.g. `turnfin.example.ie` (comma-separated for several). Required when deployed. Locally `localhost:3000` and `localhost:3100`. |
| `WORK_URL` | Activities | Optional. Work's address, for `/brand/*` when the Activities app is opened directly. Locally `http://localhost:3000`. |

Activities also needs every variable Work's pages need for sign-in and data: `DATABASE_URL`, `AUTH_SECRET` (the **same** secret as Work, or sessions will not carry over), the email settings and the parent API settings.

### Deploying on Vercel

1. Create a second Vercel project from the same repository with **Root Directory `apps/activities`**. `apps/activities/vercel.json` installs and builds from the repository root (`npm run build:activities`).
2. Give it the environment variables above, including `WORK_ORIGIN` and the same `AUTH_SECRET` and `DATABASE_URL` as Work.
3. Set `ACTIVITIES_URL` on the Work project to that deployment's address (per environment: production Work → production Activities, `dev` → `dev`).
4. The Activities project should not be used directly by staff. Leave it on its `vercel.app` address.

Each app deploys and fails separately. Work still builds the composition roots (contributions and session hooks) against the shared database, so a schema change still needs both apps in mind.

### Running locally

- `npm run dev` (Work, port 3000) and `npm run dev:activities` (port 3102). Open Work.
- `npm run sandbox` starts both against a throwaway database with fictional data. Hot reload does not reach the Activities app through Work's address, so after editing Activities code reload the page, or open `http://localhost:3102` directly.
- `npm run sandbox -- --production` builds and starts both apps. Use it to check behaviour that crosses the two apps.

## Activity types

`src/modules/activities/types.ts` defines `ACTIVITY_TYPES`. Swim school is the only one, with the features `progression`, `assessments`, `parentApp`, `waitlists` and `cover`. To add a second type, give `Programme` an additive `activityType` column (default `"swim-school"`), register the type, and make screens ask `hasFeature` instead of assuming levels and competencies exist.

## Where Core lives in the UI

Staff, Roles, Clubs, Activity and Account open in the **Core** workspace (the shared `ModuleShell`), not inside the Activities desk. `/core` opens the first Core screen a person may use, otherwise their Account. The portal shows a Core tile only to people with a Core screen. The site switcher stays in the Activities sidebar, because it filters the working timetable.

## Stages

- **Stage 0, a separate `dev` database** (code ready): `src/lib/database-environment.ts` and `DATABASE_ENVIRONMENT`, `PRODUCTION_DATABASE_HOST` and `REQUIRE_DEV_DATABASE` stop a `dev` deployment migrating production. The database itself is provisioned in Vercel; see [database-operations.md](database-operations.md#a-separate-database-for-dev).
- **Stage 1, split in code**: done (the rules above).
- **Stage 2, separate the data**: done in code, with no database change. The schema is split by owner and Activities reads people and sites only through the directory. Still to do, as one migration when wanted: move the Activities tables to their own Postgres schema, drop `User.coursesTaught` and `Club.programmes/students/courses`, and give `AuditLog` a module-neutral shape (its `programmeId` is Activities-shaped).
- **Stage 3, separate the app**: done (`apps/activities`, above).
- **Stage 4, grow**: prepared. The name is Activities with Swim school as its first type. Operator editions (Core plus a chosen set of modules, including Activities alone for a swim school) are next.

## Known follow-ups

- Refunds, Training, HR and Rota still borrow the Docs shell pieces (`components/docs/{brand,appearance-menu,primitives,ui}` and the Docs stylesheets). They should move to `components/workspace` so Work modules stop depending on Docs.
- HR reads Docs' storage configuration (`lib/hr/storage-config.ts` imports `lib/docs/storage-config`); a Core storage helper would remove it.
- Shared packages (`packages/ui-poolside`, a Core client) are not needed while both apps compile the same `src/`. They become worth it if Activities moves to its own repository or database.
- The Reception Portal preview (`scripts/reception-portal-preview`) still imports `reception.css`, which was removed with the portal's old theme.
