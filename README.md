# Swimly

The staff workspace for LeisureWorld's swim school at Bishopstown and
Churchfield: weekly classes, enrolment, attendance, progression and assessment
sessions. Staff and roles are shared; each club has its own records.

Next.js App Router · React · shadcn/Base UI · Tailwind CSS ·
Prisma 7 with the PostgreSQL driver adapter · Auth.js · Zod.

Read [PRODUCT.md](PRODUCT.md) for product scope, [DESIGN.md](DESIGN.md) for
the UI and architecture, and [AGENTS.md](AGENTS.md) for working instructions.

## Local development

Use a supported Node.js version compatible with the installed Next.js and
Prisma releases; this workspace is verified with Node.js 24.

1. Run `npm ci`. The postinstall hook generates the Prisma client.
2. For a new checkout, copy `.env.example` to `.env` and configure
   `DATABASE_URL` and `AUTH_SECRET`. Preserve existing local environment files.
3. Run `npm run dev` and open `http://localhost:3000`.

The existing development environment shares its database with production.
Do not run migrations, seeds, imports or test writes merely to inspect the app.
Use isolated fixtures for regression tests and synthetic people for screenshots.

For a deliberately provisioned **empty, isolated database**, apply the committed
migrations with `npm run db:deploy`, then set the `SEED_ADMIN_*` variables and
run `npm run db:seed` to create its first account. Clear those variables afterwards.
Schema development belongs on an isolated database; shared-schema changes must
be additive and reviewed before deployment.

Sign in at `/sign-in`. `DEV_AUTH_BYPASS=1` optionally uses an existing active
admin during local development and is ignored in production.

Development uses a Swimly-specific session cookie so other localhost apps do not
interfere with sign-in. Existing production cookies retain Auth.js's defaults.
For remote PostgreSQL connections, prefer explicit `sslmode=verify-full`; the
app normalizes the driver's legacy SSL aliases to preserve its existing
certificate and hostname verification unless libpq compatibility is requested.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Check environment, generate Prisma client, build Next.js |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | Application lint checks |
| `npm test` | Regression tests with isolated database/authentication doubles |
| `npm run db:migrate` | Create and apply schema migrations on an isolated development database |
| `npm run db:deploy` | Apply committed migrations to the configured database |
| `npm run db:seed` | Create the first administrator in a new database |
| `npm run db:seed-curriculum` | Optional starter curriculum for a new database |
| `npm run db:studio` | Open Prisma Studio against the configured database |

On Vercel production, `npm run build` applies committed migrations before
compiling the application. A failed migration stops deployment. Local and
preview builds do not apply migrations. Builds never seed records.

## Reception

`/reception` brings swimmer lookup, current class details, move/unenrol actions,
today's classes grouped by time or level, and booking shortcuts into a responsive
connected workspace. Each role can be given the Reception screen and can choose it as its
landing page. Enrolment actions still require `enrolment.manage`.

See [Reception implementation and verification](docs/reception.md).

## Interface and staging

The reviewed redesign uses owned shadcn components with Base UI behaviours,
Figtree, warm neutral surfaces, blue actions and cookie-backed light/dark themes.
Components live in `src/components/primitives` and `src/components/workspace`;
native form adapters live in `src/components/ui`. Domain metadata supplies
status colours. [DESIGN.md](DESIGN.md) defines the system and screen checklist.

The main app on `codex/staging-redesign` is published at
[swimly-staging.vercel.app](https://swimly-staging.vercel.app).
It uses the existing database: staging edits affect live records. It requires
normal credentials, disables development sign-in, and uses its own session
cookie. The existing main and dev branch deployments retain their domains.

Poolside Attendance and Competencies share a locally persisted, version-checked
autosave draft. Done taking attendance is explicit and available after saves
succeed. An additive `AttendanceCompletion` table retains that confirmation;
later roster or attendance changes reopen it. All writes retain permissions,
club scoping, audit records and capacity locks.

The fictional prototype remains isolated under `prototypes/redesign` and is
not imported by the main app. Validate the main app with `npm run typecheck`,
`npm run lint`, `npm test` and `npx next build` (without migration side effects).
Review both themes at 375, 768, 1024 and 1280px, keyboard access, reduced motion,
44px touch targets, save recovery and conflicts.
