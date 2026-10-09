# Phase 0 audit

*9 October 2026. The full audit, with numbers, is in [../modular-monolith.md](../modular-monolith.md) ("Where the code is today"). This page adds what CLAUDE.md's Phase 0 asks for on top of it.*

- **Framework and layout:** Next.js 16 App Router (`src/app`), Prisma 7 with the schema split by owner in `prisma/schema`, Auth.js, shadcn/ui. Docs and HR have their own databases. Tests run with `tsx --test`; lint is ESLint 9 flat config.
- **Module map:** approved 9 October 2026; see [README.md](README.md).
- **Platform, UI and front:** see the layer table in [README.md](README.md).
- **Cross-module interactions:** commitments (Rota asks the swim school: call), personal file and subject records (HR asks Training and Rota: call), home cards and site summaries (front reads modules: call), shift-change emails (Rota to Turnfin Me: event candidate).

## Risks

- **Routes import module internals:** about 350 imports from `src/app` into module `lib`/`components`, because no module has an `index.ts` or feature entries yet. The boundary lint lists each one as a warning.
- **Core tables read from modules:** about 110 direct queries and 45 joins of `User`, `Club`, `Qualification` and others from Work modules.
- **Modules reach the wiring:** HR and Rota import `src/modules/server.ts` for the personal file and commitments.
- **Business logic in routes:** Docs' `src/app/docs/actions.ts` is imported by Docs components.
- **Big files:** `src/modules/rota/lib/actions.ts` and the swim school's enrolment code hold many verbs each; they split naturally into features.
- **Shared Core tables:** `User` and `Club` carry Prisma back-relations to every module's tables, so `core.prisma` changes whenever a module adds a relation.
