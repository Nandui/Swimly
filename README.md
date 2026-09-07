# Swimly

The staff workspace for LeisureWorld's swim school at Bishopstown and
Churchfield: weekly classes, enrolment, attendance, progression and assessment
sessions. Staff and roles are shared; each club has its own records.

Next.js App Router · React · Astryx Neutral · Tailwind CSS for layout ·
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
bento grid. Each role can be given the Reception screen and can choose it as its
landing page. Enrolment actions still require `enrolment.manage`.

See [Reception implementation and verification](docs/reception.md).

## Astryx

[Astryx](https://astryx.atmeta.com/) is the visual authority. The app uses
`@astryxdesign/core` and `@astryxdesign/theme-neutral`, with Figtree and a
cookie-backed light/dark mode that follows the device by default.

Read installed component documentation before changing a control:

```bash
npx --no-install astryx component Button
npx --no-install astryx search "form"
npx --no-install astryx docs tokens
```

`src/components/ui/` adapts Astryx controls to native form submission.
`src/components/ui-kit/` contains shared app compositions, such as the shell,
page header and status tags. Status colours come from domain metadata maps.
Legacy generated design assets and design-kit skills are historical references;
they do not override Astryx or DESIGN.md.

UI changes must work at 375, 768, 1024 and 1280 pixels in both modes, with
44px touch targets, keyboard access and no page overflow. See the completed
[code and UI audit](docs/audit-2026-09-06.md) for evidence and remaining limits.
