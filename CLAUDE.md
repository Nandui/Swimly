@AGENTS.md

# How Turnfin's code is built

Read this whole file before any change. It is the one place for the code rules. What Turnfin is, and its words, are in [docs/how-turnfin-works.md](docs/how-turnfin-works.md); where it is going is in [docs/architecture/platform-and-apps.md](docs/architecture/platform-and-apps.md); the map of what exists today is in [docs/architecture/README.md](docs/architecture/README.md). Every doc is listed in [docs/README.md](docs/README.md).

If a request would break a rule here, stop and explain the conflict. Fernando may approve an exception; record it as a decision (ADR) in `docs/architecture/decisions/`.

## 1. The words

| Word | In docs and on screen | In code |
| --- | --- | --- |
| **Turnfin** | The product staff use: one sign-in, Home and the apps | this repository's main app |
| **App** | One area of the business inside Turnfin, opened from Home, that a role gives a level in | one `manifest.ts` |
| **Module** | never shown to staff | the folder `src/modules/<id>` that provides one or more apps (`activities` provides Swim school, Pool deck and Analytics) |
| **Platform** | what every app stands on | Core: `src/lib`, `src/auth.ts`, `src/platform/events`, `src/modules/{registry,contributions,context,server,session-hooks}.ts` (ADR 0001) |
| **Connected product** | outside Turnfin, with its own users and sign-in, using only a versioned API | Turnfin Me (`apps/me`), the Academy booking site (`apps/academy`), the parent app (its API lives in `src/app/api/parent`) |
| **Workspace** | never shown to staff | an app's frame and starter page: `features/workspace`, `src/components/workspace` |

"Turnfin Work", "surfaces", "the My hub" and "the Reception portal" are retired. Do not bring them back.

## 2. The layers

| Layer | Where | What it is | It must never |
| --- | --- | --- | --- |
| **Platform** (Core) | `src/lib`, `src/auth.ts`, `src/platform/events`, `src/modules/{registry,contributions,context,server,session-hooks}.ts`, admin screens in `src/app/(core)` and `src/components/{people,staff,clubs,devices,setup,help}` | Sign-in and devices; people, roles, sites, departments, positions, qualifications; the access engine (`src/lib/policy`); the audit log; the event bus; email; the public API toolkit; the app catalogue and Home's data | import an app's code, or name one |
| **UI kit** | `src/components/{shadcn,ui,ui-kit}`, `form-dialog`, `confirm-action`, `searchable-picker`, the theme in `src/app/theme` (ADR 0003) | Presentational components and tokens | hold business rules, fetch data, or import an app or the platform |
| **App** (module) | `src/modules/<id>/` | One area of the business, in the contract shape (section 4) | reach into another app's insides or tables |
| **Feature** | `src/modules/<id>/features/<feature>/` | One thing users can do: its screens, actions, checks, data access and tests | import a sibling feature; shared code moves to the module's `shared/` |
| **Front** | `src/components/{home,core,workspace}`, `src/lib/home.ts`, `src/lib/staff-api` (Turnfin Me's API) | Screens and APIs that combine apps | own business rules or tables, or read an app's insides |
| **Routes** | `src/app` | Thin glue: layouts check access and render a feature or front component | contain business logic |

Dependencies point down (feature → module `shared/` → platform or UI kit), or sideways only through a front door or an event. Never up, never into another app's insides.

## 3. Dependency rules

| From ↓ may import → | platform | UI kit | own module `shared/` | sibling feature | another module's `index.ts` | another module's insides |
| --- | --- | --- | --- | --- | --- | --- |
| feature | yes | yes | yes | no | sparingly | no |
| module `shared/` | yes | yes | — | no | sparingly | no |
| module `index.ts`, `module.ts`, `manifest.ts` | yes | yes | yes | own features only | sparingly | no |
| front | yes | yes | no | no | yes | no |
| routes | yes | yes | no | its own module's feature entries | yes | no |
| UI kit | no | — | no | no | no | no |
| platform | — | no | no | no | no | no |

**Sparingly** means only when the caller needs an answer now to carry on. Otherwise use an event. If two apps call each other both ways, turn one direction into an event.

Composition roots are the only files that import every module: `src/app/modules.ts`, `src/modules/server.ts`, `src/modules/session-hooks.ts`, and Turnfin Me's `src/lib/staff-api/records.ts` and `reminders.ts`.

## 4. The app contract

Every app, small or as big as a product sold on its own, has the same six parts:

| Part | File | Says |
| --- | --- | --- |
| Description | `manifest.ts`, listed in `src/app/modules.ts` | name, icon, group, starter page (`href`), levels and extras with the permissions each gives, log name |
| Plug | `module.ts`, loaded by `src/modules/server.ts` | what it gives the platform: home items (`registerHomeCard`), site summaries, person-file sections, subject records, commitments, listeners |
| Front door | `index.ts` | the few functions other apps and the front may call; functions and types only, never tables, Prisma models or internal components |
| Events | `events.ts` | what it announces, `<app>.<thing>.<past-tense-verb>`, listed in [docs/architecture/events.md](docs/architecture/events.md) |
| Own data | `prisma/schema/<id>.prisma`, or its own database (Docs, HR) | its tables; other apps keep only its ids |
| Own tests | beside the code | its rules, its front door and its events, with other apps faked |

Each module folder also has `README.md` (section 9), `shared/` and `features/`. Its page list, `features/workspace/pages.ts`, builds both its page bar and its starter page (`ModuleStart`, ADR 0007).

Permissions are named `<area>.<action>` or `<area>.<thing>.<action>` (`refunds.review`, `hr.details.write`). Each one is given by exactly one level or extra in exactly one manifest; a test checks it. Pages and actions ask for a permission, never a level or a role name.

## 5. Data and writes

**Writes.**
- A mutating action runs: authorize (a named permission), validate, guard, write, audit, revalidate, in that order. The write and its audit row share one transaction; capacity and keyholder guards run under their locks after reading the current rows. The worked shape is at the top of `src/lib/action-result.ts`.
- Errors a person can fix are return values (`{ ok: false, error }`), shown beside the field. Throwing is for "this should not have been possible".
- Reads and writes live in separate files (`server/data.ts`, `server/actions.ts`), so a read cannot quietly grow a write. A read a client component calls is a `"use server"` action that still authorizes, with a comment saying why.
- Deactivate, never delete: `User.isActive` is the off switch, reversible and audit-friendly. `AuditLog.actorName` is stored so the log survives a deletion anyway.
- A list that grows with the organisation goes behind a server search or a page, never into props.
- Dates, times and counts come only from `src/lib/format.ts`; "what day is it?" is asked in `SCHOOL_TIMEZONE` (`Europe/Dublin`), never on the server's clock.
- Scripts are part of the product: idempotent, self-disabling, audited, and deliberate when destructive (`prisma/seed.ts` is the reference: it declines once an admin exists and matches on email).

**Ownership.**
- Every table belongs to exactly one owner, named by its schema file: `core.prisma` and `base.prisma` are the platform's; every other `prisma/schema/<id>.prisma` is its module's. Existing tables keep their names (ADR 0002). A new table's model takes the app's prefix (`Stock`, `Incident`) and its table the module's (`@@map("stock_takes")`).
- Only the owner reads or writes its tables. Other apps ask through its front door, or receive what they need in an event payload.
- No joins across owners. An app reads the platform through the platform's functions, never its own queries or relation joins: `src/lib/directory.ts` (people, sites, roles, departments, positions), `src/lib/qualifications.ts`, `src/lib/setup/activity-types.ts`, `src/lib/people/records.ts`, `src/lib/audit.ts` and `src/lib/policy`.
- Database changes only add. Merging to `main` migrates production under live code, so a rename or removal goes in steps: add the new one, move the code, remove the old one in a later release, with Fernando's approval.

## 6. How apps talk

Three ways, and only these (pictures: the canvas linked from [docs/architecture/platform-and-apps.md](docs/architecture/platform-and-apps.md)):

1. **Ask now:** call another app's front door (`index.ts`) when you need the answer to carry on.
2. **Announce:** emit an event when something has happened. This is the default for "and then also…". The bus is `src/platform/events`, typed and in process. Emit after the transaction commits; a failing listener is logged and never breaks the emitter. Payloads carry ids and the minimum data, never rows. Every event is listed in `docs/architecture/events.md` in the same change.
3. **Plug in:** register with the platform from `module.ts` (`src/modules/contributions.ts`): home items, site summaries, person-file sections, subject records, commitments, desk measures, the member directory and history, area renames. The platform shows what is registered without knowing who registered it.

An app must work when any other app is switched off: a front door or registry that is missing answers "not available", and the caller copes.

## 7. Where new code goes

Decide in this order, and say which in one line of the change summary:
1. Used by one feature only → that feature.
2. Used by two or more features of one module → that module's `shared/`.
3. Used by two or more apps and holds no business terms → the platform (logic) or the UI kit (presentation).
4. Used by two or more apps and business-specific → it belongs to one app and goes out through its front door, or the boundary is wrong: ask Fernando.
5. A screen that combines apps → the front.

Move code down a layer only when a second user actually exists. The platform knows *how* (send an email, check a permission, store a file); the app decides *when and why*.

## 8. Enforcement

`npm run lint` enforces sections 2, 3 and 5: `eslint-plugin-boundaries` encodes the dependency table, and `no-restricted-imports`, `no-restricted-syntax` and `import/no-restricted-paths` refuse imports across apps and queries of another owner's tables (table ownership is read from the schema file names). Never disable a boundary rule inline without Fernando's approval and an ADR. Tests and `src/test` are exempt because they exercise routes end to end.

Not yet automatic (step 1 of the direction): nothing runs these checks on a pull request, and `main` is not protected. Run them yourself before every push.

## 9. Documentation

Docs change in the same change as the code. One fact lives in one place; link to it, never copy it.

- The doc map is [docs/README.md](docs/README.md). Add every new doc to it.
- `docs/architecture/README.md`: the app map, each app's tables, seams and events, and the diagram.
- `docs/architecture/events.md`: every event, its emitter, payload and listeners.
- `docs/architecture/decisions/NNNN-title.md`: an ADR (Context, Decision, Consequences) for an exception to these rules, a new app, splitting or merging apps, or moving something into the platform.
- `docs/<app>.md`: what an app does and its rules, for people.
- `src/modules/<id>/README.md`:

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

## 10. Checklists

**A feature in an existing app**
- [ ] It lives in `features/<feature>/`. Anything a sibling feature needs moves to `shared/`.
- [ ] New tables go in the app's schema file and only add.
- [ ] New permissions go on a level or extra in `manifest.ts`; pages go in `features/workspace/pages.ts`; route files stay thin.
- [ ] Side effects in other apps use events, listed in `events.md`.
- [ ] The front door grows only by what another app or the front actually calls.
- [ ] Tests cover it through its entry points, with other apps faked.
- [ ] The app's README and `docs/<app>.md` are updated.

**A new app**
- [ ] It is one area of the business (its purpose fits one sentence without "and"). If unsure, ask Fernando; a new app changes the app map, which he approves.
- [ ] It has the six-part contract, `README.md`, `shared/` and `features/`, and one line in `src/app/modules.ts`. Adding it changes no platform file; if it must, stop and raise it.
- [ ] It works with every other app switched off.
- [ ] It is in `docs/architecture/README.md` and `docs/README.md`, with `docs/<app>.md` and an ADR `NNNN-add-<app>-app.md`.

**Needing something from another app**
- [ ] Need the answer now? Add a small function to its front door. Otherwise listen for (or ask it to emit) an event.
- [ ] Check for a two-way dependency; turn one side into an event.

**Moving something into the platform**
- [ ] Two or more apps use it today, it holds no app's business terms, and a significant one gets an ADR.

## 11. Definition of done

- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass, and the build works.
- [ ] No boundary rule is broken or disabled; the platform names no app; no app touches another's insides or tables.
- [ ] The docs this change touches are updated, with no copied facts.
- [ ] Staff-visible changes have a CHANGELOG entry and a version bump (AGENTS.md).
- [ ] The summary says which layers changed and why the code lives where it does.

## 12. How to behave

- Small, reviewable steps, one commit per step.
- When a boundary call is unclear, decide with section 7, say so, and carry on. Ask only when it changes table ownership or the app map, or needs an exception.
- Never delete files, rename tables or run migrations without Fernando's approval.
- Code that breaks these rules, found while doing something else, is mentioned in the summary and fixed as its own change, not silently.

## 13. UI rules (owner rules, 20 October 2026)

Fernando's hard rules for the whole app, existing and new features, in his words:

- Only use components from `Shadcn`.
- No arbitrary Tailwind values like `p-[13px]` or `text-[#333]`.
- No inline styles or new colours.
- Every page uses `PageShell` and `PageHeader`.

No skill, taste or otherwise, overrules them. What they mean in practice:

- **Components:** controls come from `src/components/shadcn`; the frame pieces in `src/components/ui-kit` and `src/components/ui` are built from them. Charts use the shadcn Chart (`src/components/shadcn/chart.tsx`, recharts) and bars use `Progress`; never hand-drawn `<svg>`. Icons are lucide-react.
- **No arbitrary values:** use the Tailwind scale, the named theme utilities in `src/app/shadcn.css` (`rounded-card`, `grid-cols-tiles`, `basis-field`, `max-w-deck`…) or a theme variable as `(--name)`, such as `max-h-(--pc-overlay-max-height)`. Variants such as `data-[state=open]:` are selectors, not values, and stay allowed.
- **No inline styles:** no `style` attribute in any page or component (only the vendored shadcn source keeps its own). A size or place that comes from data uses the safelisted fraction and grid classes through `src/components/ui-kit/scale.ts` (`widthOf`, `leftOf`, `stretchOf`, `col-start-12`), a data attribute styled in CSS, or a shadcn component.
- **No new colours:** colours are defined only in `src/app/theme/poolside.css` and `src/app/shadcn.css`; everything else uses their tokens (`ui-` utilities, `--pc-*`). No hex, `rgb()`, `hsl()`, `oklch()` or `color-mix()` anywhere else, in TSX or CSS.
- **Every page:** `<PageShell header={<PageHeader … />}>` is each page's body, with its one H1 in the PageHeader. A page's own layout class goes on PageShell (`className="po-desk"`); `spacing="roomy"` gives 24px between blocks.
- If something can't be built from existing components and tokens, **ask Fernando before adding a token or component.** Never invent one to get past the lint.

Why: most "AI ugliness" comes from inconsistency, not bad taste.

`npm run lint` enforces all four: `turnfin/no-literal-styles`, `turnfin/no-inline-styles` and `turnfin/page-header-in-shell` (`scripts/lint/design-tokens.mjs`), the `<svg>` ban in `eslint.config.mjs`, and `scripts/lint/ui-rules.mjs` (every page reaches a PageShell; colour literals only in the two theme files). Tests, email templates and the browser theme colour in `src/app/layout.tsx` are exempt, because they need literal values. `eslint-suppressions.json` is empty and stays empty; never add to it, and never disable a rule inline, without Fernando's approval. `scripts/ui-rules/check-pages.mjs` opens every page in a running app and checks each has one PageShell with its PageHeader and H1.

The same rules cover the connected products Turnfin Me (`apps/me`) and the Academy booking site (`apps/academy`). Each has its own shadcn components and copies of the ui-kit pieces, and theme files that are exact copies of Turnfin's (`ui-rules.mjs` checks they match). `npm run lint` in each runs the same ESLint rules (shared from `scripts/lint/design-tokens.mjs`) and `ui-rules.mjs`.
