<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Turnfin 2.0: rules for working in this repository

This is the one rulebook for anyone changing Turnfin: people and coding agents alike (Claude, ChatGPT, Codex or any other). `CLAUDE.md` only points here. If a request would break a rule here, stop and explain the conflict; the owner (Fernando) may approve an exception, recorded in [docs/decisions.md](docs/decisions.md).

Turnfin is the staff product for LeisureWorld's leisure centres. Version 2.0 is a **platform of apps** with a **new design** on the way, evolved from the live app step by step. The repository is named Swimly; that is a working name only.

## Read first

1. [PRODUCT.md](PRODUCT.md): what Turnfin is, who uses it, the five sentences, the words and the pillars every change is judged against.
2. This file, all of it.
3. [docs/architecture.md](docs/architecture.md): how it is built, and what is built versus planned.
4. [docs/roadmap.md](docs/roadmap.md): what is being built next, in order.
5. As the task needs: [docs/apps.md](docs/apps.md) (every app and its levels), [docs/operations.md](docs/operations.md) (environments, databases, settings), [DESIGN.md](DESIGN.md) (the design and its status), [docs/decisions.md](docs/decisions.md), and the module's own `src/modules/<id>/README.md`.

The map of every doc is [docs/README.md](docs/README.md). Nothing written before 2.0 binds you; if old code or a comment disagrees with these docs, the docs win and the code is fixed.

## Working agreement

- Carry the requested work through implementation and verification. Decide routine things from context; ask only when a missing answer changes the result, and keep going with work that does not depend on it.
- Judge every proposal against the pillars. Prefer removing a concept to adding one. Give one recommendation, not a menu. Say plainly when existing work, including your own, goes against a pillar.
- Small, reviewable steps, one commit per step.
- Never, without the owner's yes: delete or overwrite data, rename or drop tables, run migrations or scripts against a real database, force-push, deploy, protect or reconfigure `main`, send emails or messages, or change settings in Vercel, Neon or Google.
- Code that breaks these rules, found while doing something else, is named in your summary and fixed as its own change.
- Do not delegate to subagents unless the user asks. Local skills are adapted in [SKILLS.md](SKILLS.md); user instructions come before skills.
- Report what changed, which checks ran and their result, and what is left, in plain English.

## The words in code

Use [PRODUCT.md](PRODUCT.md)'s words with people. In code:

| Word | In code |
| --- | --- |
| **App** | one `manifest.ts` |
| **Module** | the folder `src/modules/<id>` that provides one or more apps (`activities` provides Swim school, Pool deck and Analytics). Never shown to staff |
| **Workspace** | an app's frame and starter page (`features/workspace`, `src/components/workspace`). Never shown to staff |
| **Platform** (Core) | `src/lib`, `src/auth.ts`, `src/platform/events`, `src/modules/{registry,contributions,context,server,session-hooks}.ts` |
| **Club** | a site (`Club` table). Say "site" to staff |
| **Group** | the part of the centre an app serves, for ordering only (`MODULE_GROUPS`). Not "department" (Rota's departments are data) or "area" (a site's pools and rooms) |

Retired, never to return: "Turnfin Work", "surfaces", "My hub", "the Reception portal".

## Layers and dependencies

The layers and their folders are in [docs/architecture.md](docs/architecture.md#layers-and-folders). Dependencies point down (feature → module `shared/` → platform or UI kit), or sideways only through a front door or an event.

| From ↓ may import → | platform | UI kit | own module `shared/` | sibling feature | another module's `index.ts` | another module's insides |
| --- | --- | --- | --- | --- | --- | --- |
| feature | yes | yes | yes | no | sparingly | no |
| module `shared/` | yes | yes | — | no | sparingly | no |
| module `index.ts`, `module.ts`, `manifest.ts` | yes | yes | yes | own features only | sparingly | no |
| front | yes | yes | no | no | yes | no |
| routes | yes | yes | no | its own module's feature entries | yes | no |
| UI kit | no | — | no | no | no | no |
| platform | — | no | no | no | no | no |

- **Sparingly** means only when the caller needs the answer now to carry on; otherwise use an event. If two apps call each other both ways, turn one direction into an event.
- The platform never imports or names an app. The UI kit holds no business rules and fetches no data. Routes stay thin: a layout checks access, a page renders a feature or front screen.
- Only the composition roots import every module: `src/app/modules.ts`, `src/modules/server.ts`, `src/modules/session-hooks.ts`, `src/lib/staff-api/records.ts`, `src/lib/staff-api/reminders.ts`.

## The app contract

Every app has the six parts described in [docs/architecture.md](docs/architecture.md#the-app-contract): description (`manifest.ts`), plug (`module.ts`), front door (`index.ts`), events (`events.ts`), own data and own tests, plus `README.md`, `shared/` and `features/`.

- A front door exports functions and types only, never tables, Prisma models or internal components, and grows only by what another app or the front actually calls.
- Front doors, events and public APIs **only grow**: add a field or function, never rename or remove it in the same change. A change goes expand-then-contract: add the new one, move the callers, remove the old one in a later release.
- Permissions are named `<area>.<action>` or `<area>.<thing>.<action>`. Each is given by exactly one level or extra in one manifest (a test checks it). An app has at most two extras.
- An app must work when any other app is switched off: a missing front door or plug answers "not available", and the caller copes.
- Every plug registration and event listener names its app (`app`), so a switched-off app goes quiet. Whether an app is on is asked only through `appOn` or `sitesWhereOn` (`src/lib/apps/switches.ts`); an app's API route files wrap their handlers in `appRoute` ([docs/architecture.md](docs/architecture.md#app-switches)).
- The module README follows this shape:

```md
# <App name>

**Purpose:** one sentence, no "and".

## Features
- `<feature>`: what a user can do

## Front door (index.ts)
- `functionName(args)`: what it returns and when to use it

## Data owned
- `<Table>`: what it stores

## Events
- Emits: `<app>.<thing>.<verb>`, when
- Listens to: `<other>.<thing>.<verb>`, what it does

## Permissions
- `<area>.<action>`

## Depends on
- Platform: …
- Other apps (front door): … (say why)
```

## Data and writes

**Writes.**
- A mutating action runs, in order: authorize (a named permission), validate, guard, write, audit, revalidate. The write and its audit row share one transaction; capacity and keyholder guards run under their locks after reading the current rows. The worked shape is at the top of `src/lib/action-result.ts`.
- Errors a person can fix are return values (`{ ok: false, error }`), shown beside the field. Throwing is for "this should not have been possible".
- Reads and writes live in separate files (`server/data.ts`, `server/actions.ts`). A read a client component calls is a `"use server"` action that still authorizes, with a comment saying why.
- **Every change to data writes one audit row** (`src/lib/audit.ts`).
- Deactivate, never delete (`User.isActive`).
- A list that grows with the organisation goes behind a server search or paging, never into props.
- Dates, times and counts come only from `src/lib/format.ts`; "what day is it?" is asked in `Europe/Dublin`, never on the server's clock.
- Scripts are part of the product: idempotent, audited, dry-run until `--confirm` when they write, and they refuse to run twice where that would harm (`prisma/seed.ts` declines once an admin exists).

**Ownership.**
- Every table has exactly one owner, named by its schema file: `core.prisma` and `base.prisma` are the platform's; every other `prisma/schema/<id>.prisma` is its module's. Existing tables keep their names. A new model takes the app's prefix (`StockTake`) and its table the module's (`@@map("stock_takes")`). Every new table carries `orgId`.
- Only the owner reads or writes its tables. Other apps ask its front door or receive what they need in an event.
- No joins across owners. Apps read the platform only through its functions: `src/lib/directory.ts`, `src/lib/qualifications.ts`, `src/lib/setup/activity-types.ts`, `src/lib/people/records.ts`, `src/lib/audit.ts`, `src/lib/policy`.
- **Database changes only add**, because merging to `main` migrates production under live code. Removals wait for the owner's yes, in a later release.
- Never rename or edit a migration once its branch is pushed.

## How apps talk

Three ways only ([docs/architecture.md](docs/architecture.md#how-apps-talk)):
1. **Ask now** through another app's front door.
2. **Announce** with an event after something has happened: the default for "and then also…". Emit after the transaction commits; a failing listener never breaks the emitter; payloads carry ids and the minimum data, never rows; name it `<app>.<thing>.<past-tense-verb>`; add it to the catalogue in `docs/architecture.md` in the same change.
3. **Plug in** from `module.ts` through `src/modules/contributions.ts`.

## Access

The model is in [docs/architecture.md](docs/architecture.md#access-who-can-do-what-where). The rules:
- Pages and actions ask for a **permission**, never a level or a role name. Nothing in code, menus or seed refers to a role by name.
- Code that reads or changes **other people's records** uses the policy engine (`src/lib/policy`) with a resource, and filters lists with `subjectsFor` or `sitesFor`.
- Home, menus, cards and hidden buttons are presentation, **never security**: every page and action checks again.
- Administrators never inherit restricted permissions; only a superadmin gives HR. Restricted reads and writes need a fresh sign-in and are logged.
- Never copy permissions into an app's own database; read identity through the directory and decide with the engine.
- No raw rows reach the browser or an API: map records through an allowlist, with tests.
- Self-service code (`*/mine.ts`, `*/self.ts`) serves only the signed-in person's own records, through the staff API. Turnfin gains no personal pages; they belong in Turnfin Me.
- The rules that protect swimmers' and staff data, and the pool deck's limits, are in [docs/apps.md](docs/apps.md#rules-that-protect-people). Keep them in every change.

## Where new code goes

Decide in this order and say which in one line of your summary:
1. Used by one feature → that feature.
2. Used by two or more features of one module → its `shared/`.
3. Used by two or more apps and holds no business terms → the platform (logic) or the UI kit (presentation).
4. Used by two or more apps and business-specific → it belongs to one app and goes out through its front door, or the boundary is wrong: ask the owner.
5. A screen that combines apps → the front.

Move code down a layer only when a second user actually exists. The platform knows *how* (send an email, check a permission, store a file); the app decides *when and why*.

## Screens

The look is set by [DESIGN.md](DESIGN.md). **Its status is open**: until the 2.0 contract is written there, add no new visual ideas, tokens or restyled components to the live app. These rules hold for any design (owner rules, 20 October 2026):

- **Components from the kit.** Controls come from the shadcn components in `src/components/shadcn`; frame pieces in `src/components/ui-kit` and `src/components/ui` are built from them. Charts use the kit's chart (recharts), never hand-drawn `<svg>`. Icons are lucide-react.
- **No arbitrary values.** Use the Tailwind scale, the named theme utilities in `src/app/shadcn.css` or a theme variable as `(--name)`. Variants such as `data-[state=open]:` are selectors and allowed.
- **No inline styles.** No `style` attribute in any page or component (vendored shadcn source excepted). A size from data uses the scale helpers in `src/components/ui-kit/scale.ts`, a data attribute styled in CSS, or a kit component.
- **No new colours.** Colours are defined only in the theme files (`src/app/theme`, `src/app/shadcn.css`); everything else uses their tokens.
- **One page frame.** Every page's body is `<PageShell header={<PageHeader … />}>`, with its one H1 in the PageHeader.
- A token or component that does not exist yet is the owner's call; ask, never invent one to get past lint.
- Plain staff words on screen (PRODUCT.md), and every screen covers loading, empty, error and saved states.
- Turnfin Me and the Academy booking site follow the same rules with their own copies of the kit and theme.

The 2.0 design contract may replace the kit, tokens and page frame; when it does, these rules follow the new ones.

## Every change

- **Checks.** Code changes pass `npm run typecheck`, `npm run lint` and `npm test`, plus focused checks for the behaviour changed; screen changes are seen in the running app (sandbox) at phone, tablet and desktop widths. Doc-only changes: check the links and the diff.
- **What's new.** Anything staff will notice gets a plain-language entry in [CHANGELOG.md](CHANGELOG.md) and a matching `version` bump in `package.json` and `package-lock.json`. Staff read it at `/whats-new`: write what they will see or do differently, in their words, with no technical terms. Shape: `## <version> · <day month year> · <title>`, then `- ` lines (`src/lib/whats-new.test.ts` checks it). The first such release from the 2.0 roadmap is 2.0.0.
- **Docs.** Update the docs the change touches in the same change. One fact lives in one place; link to it, never copy it. Levels changed in a manifest are changed in `docs/apps.md`; an event in the catalogue; a setting in `docs/operations.md` and `.env.example`; a new decision in `docs/decisions.md`. A new doc is added to `docs/README.md`.
- **Data in examples.** Keep real swimmer names, contacts and medical notes out of tests, exports, screenshots and artifacts; use synthetic examples. Never run seeds, imports or database writes just to inspect or test.
- **Secrets.** Never print or commit `.vercel/swimly-operations.json`, `.env*` values or any token.

## Checklists

**A feature in an existing app**
- [ ] It lives in `features/<feature>/`; anything a sibling needs moves to `shared/`.
- [ ] New tables go in the app's schema file and only add.
- [ ] New permissions go on a level or extra in `manifest.ts`; pages go in `features/workspace/pages.ts`; routes stay thin.
- [ ] Side effects in other apps are events, in the catalogue.
- [ ] Tests cover it through its entry points, with other apps faked.
- [ ] The module README and `docs/apps.md` are updated where they change.

**A new app** (the owner approves each one)
- [ ] One area of the business; its purpose fits one sentence without "and".
- [ ] The six-part contract, `README.md`, `shared/`, `features/`, and one line in `src/app/modules.ts`. It changes no platform file; if it must, stop and raise it.
- [ ] It works with every other app switched off, and goes live at one site first.
- [ ] It is in `docs/apps.md` and `docs/decisions.md`.

**Needing something from another app**
- [ ] Need the answer now? A small function on its front door. Otherwise an event.
- [ ] No two-way dependency.

**Moving something into the platform**
- [ ] Two or more apps use it today and it holds no app's business terms; a significant move gets a decision entry.

## Definition of done

- [ ] Typecheck, lint and tests pass, and the build works.
- [ ] No boundary rule broken or disabled; the platform names no app; no app touches another's insides or tables.
- [ ] Docs updated, with no copied facts.
- [ ] Staff-visible changes have a What's new entry and version bump.
- [ ] Your summary says which layers changed and why the code lives where it does.

## Enforcement

`npm run lint` enforces the layers, dependencies, table ownership and screen rules:
- `eslint-plugin-boundaries` encodes the dependency table; `no-restricted-imports`, `no-restricted-syntax` and `import/no-restricted-paths` refuse imports across apps and queries of another owner's tables (ownership is read from the schema file names).
- `turnfin/no-literal-styles`, `turnfin/no-inline-styles` and `turnfin/page-header-in-shell` (`scripts/lint/design-tokens.mjs`), the `<svg>` ban (`eslint.config.mjs`) and `scripts/lint/ui-rules.mjs` (every page reaches a PageShell; colour literals only in the theme files; Turnfin Me's and the Academy site's theme copies match).
- `scripts/ui-rules/check-pages.mjs` opens every page in a running app and checks its frame and H1.

Tests, email templates and the browser theme colour in `src/app/layout.tsx` are exempt where they need literal values. `eslint-suppressions.json` stays empty. Never disable a rule inline or add a suppression without the owner's yes and a decision entry.

Nothing yet runs these checks on pull requests and `main` is unprotected (roadmap step 1): run them yourself before every push.

## Databases in brief

Prisma 7: the client is generated into `src/generated/prisma` with the `@prisma/adapter-pg` adapter; the datasource is in `prisma.config.ts`; after pulling schema changes run `npx prisma generate`. Docs and HR have their own databases; never point them at the main `DATABASE_URL`. Previews migrate only their own development database. Record work the user has authorised uses `npm run db:check` and `npm run db:run`, never a Postgres password and never computer control. Details: [docs/operations.md](docs/operations.md).
