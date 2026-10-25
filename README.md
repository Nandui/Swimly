# Turnfin

Turnfin is the staff product for LeisureWorld's leisure centres: a platform of apps (Swim school, Pool deck, Rota, Training, HR, Incidents, Purchasing and more) with one sign-in, where each person's job opens the apps they need and Home shows what is waiting for them. This is **Turnfin 2.0**: the platform of apps, with a new design on the way. The repository's name, Swimly, is a working name only.

## Start here

1. [PRODUCT.md](PRODUCT.md): what Turnfin is and the rules every decision is judged against.
2. [AGENTS.md](AGENTS.md): how to work in this repository, for people and coding agents.
3. [docs/README.md](docs/README.md): every other doc.

## What is in this repository

| Folder | What |
| --- | --- |
| `src` | Turnfin: the platform (`src/lib`, `src/platform`), the apps (`src/modules`) and their routes (`src/app`) |
| `apps/me` | Turnfin Me, each person's own records on their phone (a connected product) |
| `apps/academy` | the public Academy booking site (a connected product) |
| `prisma/schema` | the main database's schema, one file per owner |
| `docs-database`, `hr-database` | the Docs and HR databases' migrations |
| `scripts` | the sandbox, lint rules, database operations, help screenshots |

The parent app is a separate repository ([swimly-public-app](https://github.com/Nandui/swimly-public-app)) that uses Turnfin's parent API.

## Running it

Node.js 24. Run `npm ci`, then `npm run sandbox` and open `http://localhost:3100`: Turnfin on throwaway databases with a fictional leisure group, never touching a real database. Everything else (your own database, previews, production, every command and setting) is in [docs/operations.md](docs/operations.md).

Before pushing: `npm run typecheck`, `npm run lint` and `npm test`.
