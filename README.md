# Turnfin

Turnfin is the staff product for LeisureWorld's leisure centres: a set of apps (Swim school, Pool deck, Rota, HR, Refunds, Training and the rest) on one platform, with one sign-in. Each person's role gives them a level in each app, and Home shows what waits for them. This repository's name, Swimly, is a working name only.

Start with [docs/how-turnfin-works.md](docs/how-turnfin-works.md): Turnfin in five sentences, its words and the pillars every decision is judged against. Then [docs/README.md](docs/README.md) lists every other doc by topic.

| Read | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | how to work in this repository |
| [CLAUDE.md](CLAUDE.md) | how the code is built: layers, the app contract, the rules lint enforces, the UI rules |
| [PRODUCT.md](PRODUCT.md) | who each screen is for and what it must get right |
| [DESIGN.md](DESIGN.md) | Poolside Clear v2, the one design |
| [CHANGELOG.md](CHANGELOG.md) | what changed for staff, version by version (also on the What's new page) |

## What is in this repository

| Folder | What |
| --- | --- |
| `src` | Turnfin itself: the platform, the apps (`src/modules`) and their routes (`src/app`) |
| `apps/me` | Turnfin Me, the connected product for each person's own records |
| `apps/academy` | the public Academy booking site |
| `prisma/schema` | the main database's schema, one file per owner |
| `docs-database`, `hr-database` | the Docs and HR databases' migrations |
| `scripts` | the sandbox, lint rules, database operations and screenshots |

The parent app is a separate repository ([swimly-public-app](https://github.com/Nandui/swimly-public-app)) that uses Turnfin's parent API.

## Running it

Node.js 24. Run `npm ci` once; it generates the Prisma client.

- **Sandbox (start here):** `npm run sandbox`, then open `http://localhost:3100`. It starts throwaway databases with a fictional leisure group and never touches a real database.
- **Your own database:** copy `.env.example` to `.env`, set `DATABASE_URL` and `AUTH_SECRET`, then `npm run dev` and open `http://localhost:3000`. On a new, empty database run `npm run db:deploy`, set the `SEED_ADMIN_*` variables and run `npm run db:seed` for the first account, then clear those variables.
- **Previews and production** are built by Vercel. Previews migrate their own development database; production migrates on `main`. See [docs/database-operations.md](docs/database-operations.md).

Never run migrations, seeds, imports or test writes against a real database just to inspect the app.

| Command | Purpose |
| --- | --- |
| `npm run sandbox` | Turnfin on throwaway databases with fictional data |
| `npm run dev` | Development server against your `.env` |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint, the boundary rules and the UI rules |
| `npm test` | Regression tests with isolated database and sign-in doubles |
| `npm run build` | What Vercel runs: check the environment, migrate (production only), generate the client, build |
| `npm run db:migrate` | Create and apply a migration on an isolated database |
| `npm run db:deploy` | Apply committed migrations to the configured database |
| `npm run db:seed` | Create the first administrator in a new database |
| `npm run db:seed-curriculum` | Optional starter curriculum for a new database |
| `npm run db:studio` | Prisma Studio against the configured database |
| `npm run db:check`, `npm run db:run`, `npm run prod` | The secured record-management workflow ([docs/database-operations.md](docs/database-operations.md)) |
