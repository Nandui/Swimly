@AGENTS.md

# Architecture rules for this codebase

## ▶ START HERE — instructions for Claude Code

You are working in a codebase that is being moved to (or already follows) the architecture described in this file. Do the following **every time you start a session**, before acting on the user's request.

### Step 1 — Read this whole file
Every rule below applies to every change you make. Don't skim. Sections 1–9 are the rules, section 10 is the one-time migration plan, sections 11–13 cover all future work.

### Step 2 — Check where the migration stands
Look for `docs/architecture/MIGRATION.md`.

- **It does not exist** → the migration has not started. Create it from the template at the end of this block, then tell the user:
  > "This repo hasn't been migrated to the modular architecture yet. I'll start with Phase 0: a read-only audit of the codebase, written to docs/architecture/audit.md, then stop for your review. Shall I begin?"
  
  Wait for the user to confirm, then do **Phase 0 only** (section 10) and stop.
- **It exists and a phase is unfinished** → read it, tell the user in one or two lines where things stand and what the next step is, and ask whether to continue with that step or do something else.
- **It says the migration is complete** → skip to Step 3.

If the user's message asks for something specific (a bug fix, a new feature), do that instead of the migration. But do it following these rules, and mention the migration status in one line at the end.

### Step 3 — For every task, follow these rules
1. Before writing code, decide which layer and folder it belongs in, using section 7. State it in one line ("This goes in `modules/sales/features/quotes/` because…").
2. Follow the dependency rules (section 3) and data ownership rules (section 4). Never work around them. If a request would break them, stop and explain the conflict.
3. Use the matching checklist in section 11 for new features, new modules, cross-module needs, or moving things to the platform.
4. Update documentation in the same change (section 9).
5. Finish with the definition of done (section 12), and report which layers you touched and why.

### Step 4 — Things you must always ask before doing
- Approving or changing the module map or boundaries
- Renaming or altering database tables, or running migrations
- Deleting files
- Any exception to these rules (record it as an ADR once approved)

### Step 5 — Keep MIGRATION.md up to date
Until the migration is complete, update `docs/architecture/MIGRATION.md` at the end of every working session: tick finished steps, note the current step, and record anything blocked or awaiting the user's decision.

### MIGRATION.md template

```md
# Migration to modular architecture

**Status:** Phase 0 — not started
**Next step:** Run the Phase 0 audit

## Phases
- [ ] Phase 0 — Audit written to docs/architecture/audit.md
- [ ] Phase 0 — Module map approved by user
- [ ] Phase 1 — Scaffold folders, registry, event bus, aliases
- [ ] Phase 1 — Boundary lint added (warning mode)
- [ ] Phase 2 — Modules moved (list each below as it's done)
- [ ] Phase 3 — Data ownership documented, cross-module table access removed
- [ ] Phase 4 — Boundary lint switched to error and proven
- [ ] Phase 4 — Docs finalised

## Modules moved
- (none yet)

## Awaiting user decision
- (none)

## Log
- YYYY-MM-DD — what was done
```

---

This project is a **modular monolith** organised in layers: a thin **platform**, a shared **UI kit**, **modules** that each contain **features**, and a **front** layer for screens that combine modules.

These rules apply to every change you make in this repository: refactors, new features, new modules and bug fixes. Read this file in full before starting any task. If a request would break a rule here, stop and explain the conflict instead of working around it. The user may approve an exception, and that exception must be recorded as a decision record (see Documentation).

The examples use TypeScript paths with an `@/` alias pointing at `src/`. Adapt the names to this project's language, framework and existing conventions, but keep the structure and the rules.

---

## 1. The layers

| Layer | Folder | What it is | What it must never do |
|---|---|---|---|
| **Platform** | `src/platform/` | General infrastructure every module needs: auth, users and teams, permission checking, notification sending, file storage, audit log, settings, database client, event bus, module registry. | Know that any module exists. No module names, business terms or module imports. |
| **UI kit** | `src/ui/` | Presentational components and design tokens: buttons, tables, forms, inputs, layouts. | Contain business rules, fetch data, or import from modules. |
| **Module** | `src/modules/<module>/` | One area of the business. It has a public API (`index.ts`), a registration file (`module.ts`), a module-level `shared/` folder, and `features/`. | Reach into another module's internals or another module's database tables. |
| **Feature** | `src/modules/<module>/features/<feature>/` | One capability users can perform. It holds its UI, logic, data access, validation and tests. | Import from a sibling feature. Shared code moves down into the module's `shared/` instead. |
| **Front** | `src/front/` | Screens that combine several modules: the home dashboard, global search, cross-module reports. | Own business rules or tables, or import module internals. It reads only through module public APIs. |
| **App / routes** | `src/app/` (or the framework's routing folder) | Thin routing glue. Routes render feature or front components and wire up layouts. | Contain business logic. Keep route files to a few lines. |

**Golden rule:** dependencies point **down** (feature → module shared → platform/ui), or **sideways only through a public API or an event**. Never up. Never into another module's insides.

---

## 2. Target folder structure

```
src/
  platform/
    auth/
    users/
    permissions/
    notifications/
    files/
    audit/
    events/              # in-process event bus + typed event map
    registry/            # loads module.ts plugs (nav, permissions, search, notifications)
    db/
    index.ts             # platform public API
  ui/
  modules/
    <module>/
      index.ts           # PUBLIC API for other modules and front — the only importable entry
      module.ts          # registration plug (see section 5)
      events.ts          # events this module emits (names + payload types)
      README.md          # module documentation (template in section 9)
      shared/            # code shared by 2+ features of THIS module only
      features/
        <feature>/
          components/
          server/        # actions, queries, services
          data/          # repository / table access for this feature
          schema.ts      # validation
          index.ts       # feature entry, used only by its own module and by app routes
          __tests__/
  front/
    dashboard/
    search/
  app/
    modules.ts           # the single list of enabled module plugs
docs/
  architecture/
    README.md            # overview + module map (keep current)
    events.md            # catalogue of every event: emitter, payload, listeners
    decisions/           # ADRs: NNNN-short-title.md
```

---

## 3. Dependency rules

| From ↓ may import → | platform | ui | own module `shared/` | sibling feature (same module) | other module `index.ts` | other module internals |
|---|---|---|---|---|---|---|
| feature | ✅ | ✅ | ✅ | ❌ | ⚠️ sparingly | ❌ |
| module `shared/` | ✅ | ✅ | — | ❌ | ⚠️ sparingly | ❌ |
| module `index.ts` / `module.ts` | ✅ | ✅ | ✅ | ✅ (own features only) | ⚠️ sparingly | ❌ |
| front | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| app / routes | ✅ | ✅ | ❌ | ✅ (render feature entry) | ✅ | ❌ |
| ui | ❌ | — | ❌ | ❌ | ❌ | ❌ |
| platform | — | ❌ | ❌ | ❌ | ❌ | ❌ |

⚠️ **Sparingly** means a direct call is allowed only when the caller needs an answer immediately to continue (e.g. "is this item available?"). Otherwise use an event. If two modules end up calling each other directly in both directions, convert one direction to an event.

Allowed and forbidden imports, by example:

```ts
// ✅ another module via its public API
import { getOpenQuotes } from "@/modules/sales";

// ❌ another module's internals
import { quotesTable } from "@/modules/sales/features/quotes/data/table";

// ❌ sibling feature — move the shared bit to modules/hr/shared/
import { calcEntitlement } from "@/modules/hr/features/leave/server/calc"; // inside hr/features/rota

// ❌ platform importing a module
import { hrModule } from "@/modules/hr"; // inside src/platform/**
```

---

## 4. Data ownership

- Every table has **exactly one owning module**. Name tables with the module prefix (`hr_leave_requests`, `sales_quotes`), or use one database schema per module if the database supports it. Platform tables use `platform_` or keep their existing core names (`users`, `teams`).
- Only the owning module reads or writes its tables. Features inside a module may share tables through that module's `shared/` data code.
- Another module that needs the data either asks through the owner's `index.ts`, or receives what it needs in an event payload.
- **No cross-module joins.** If a screen needs combined data, `front/` calls each module's API and merges the results. If performance genuinely requires a join, raise it with the user and record an ADR.
- A module may store foreign IDs (e.g. `employee_id` in a support table) but must not rely on another module's table structure.

---

## 5. The module plug (`module.ts`)

Each module registers itself. The platform's registry loops over `app/modules.ts`. The platform never imports a module by name.

```ts
// src/modules/hr/module.ts
import { defineModule } from "@/platform/registry";
import { searchEmployees } from "./features/directory";

export const hrModule = defineModule({
  id: "hr",
  name: "HR",
  nav: [
    { label: "Leave", href: "/hr/leave", permission: "hr.leave.view" },
    { label: "Rota", href: "/hr/rota", permission: "hr.rota.view" },
  ],
  permissions: ["hr.leave.view", "hr.leave.approve", "hr.rota.view"],
  notifications: ["hr.leave.approved", "hr.leave.rejected"],
  search: searchEmployees, // optional: contributes to global search
});
```

```ts
// src/app/modules.ts — the ONE place listing modules
export const modules = [hrModule, salesModule, supportModule];
```

Naming conventions:
- Permissions: `<module>.<feature>.<action>`, e.g. `sales.quotes.approve`.
- Events: `<module>.<thing>.<past-tense-verb>`, e.g. `hr.employee.started`.
- Notification types: same shape as events.

If modules can be enabled per customer/tenant, the registry filters this list. Modules must work when other modules are disabled. Never assume another module is present.

---

## 6. Communication between modules

**Direct call (hatch):** when the caller needs a reply now. Only through the other module's `index.ts`. Keep each module's public API small. Export functions and types, never tables, ORM models or internal components.

**Event (bell):** when announcing that something happened, and for any "and then also…" side effect. This is the default between modules.

```ts
// src/modules/hr/events.ts
export type HrEvents = {
  "hr.employee.started": { employeeId: string; startDate: string };
};

// emitter (inside an HR feature)
await events.emit("hr.employee.started", { employeeId, startDate });

// listener (inside the Support module, registered from its module.ts or a listeners file)
events.on("hr.employee.started", createHelpdeskAccount);
```

Rules:
- The event bus lives in `platform/events`. It is typed and in-process.
- Payloads carry IDs plus the minimum data listeners need. They must not carry table rows or ORM objects.
- Emit **after** the database transaction commits. A failing listener must not roll back or break the emitter. Log the failure, and retry where appropriate.
- Every event is listed in `docs/architecture/events.md` with its emitter, payload and listeners. Update this file in the same change that adds or alters an event.

---

## 7. Where does new code go? (decide in this order)

1. **Is it only used by one feature?** → in that feature.
2. **Used by 2+ features of the same module?** → that module's `shared/`.
3. **Used by 2+ modules AND contains no business-specific terms?** → `platform/` (logic) or `ui/` (presentational).
4. **Used by 2+ modules but IS business-specific?** → it belongs to one owning module and is exposed through its `index.ts`, or the boundary is wrong. Ask the user.
5. **A screen combining several modules?** → `front/`.

**Rule of two:** never move code down a layer in anticipation. Move it only when a second consumer actually exists.

**How vs when:** the platform knows *how* (send a notification, check a permission, store a file). The module decides *when and why* ("leave approved" → notify the employee).

---

## 8. Enforcement

Boundaries must be enforced by tooling, not by comments.

- Configure **eslint-plugin-boundaries** (preferred), or **dependency-cruiser**, to encode the table in section 3. Check the installed version's documentation for exact config syntax rather than guessing.
- Add or update path aliases so `@/platform`, `@/ui`, `@/modules/<name>` and `@/front` resolve.
- The boundary check runs in `lint` and in CI, and fails the build on violations.
- After configuring, **prove it works**: add a deliberate violating import (e.g. platform → module), confirm the lint fails, then remove it. Report the result.
- Never disable a boundary rule inline (`eslint-disable`) without the user's explicit approval and an ADR.

---

## 9. Documentation

Keep documentation current **in the same change** as the code. Docs are part of "done".

**`docs/architecture/README.md`** covers:
- a short overview of the layers (link back to this file),
- the module map: each module, its features, one-line purpose, owner tables, events emitted and consumed,
- a Mermaid diagram of modules and their dependencies (direct calls as solid arrows, events as dashed).

**`docs/architecture/events.md`** is the event catalogue.

**`docs/architecture/decisions/NNNN-title.md`** holds ADRs, short ones: Context, Decision, Consequences. Write one for any rule exception, a new module, splitting or merging modules, or moving something into the platform.

**`src/modules/<module>/README.md`** follows this template:

```md
# <Module name>

**Purpose:** one sentence, no "and".

## Features
- `<feature>` — what a user can do

## Public API (index.ts)
- `functionName(args)` — what it returns / when to use it

## Data owned
- `<module>_<table>` — what it stores

## Events
- Emits: `<module>.<thing>.<verb>` — when
- Listens to: `<other>.<thing>.<verb>` — what it does in response

## Permissions
- `<module>.<feature>.<action>`

## Depends on
- Platform: auth, notifications, …
- Other modules (direct calls): … (justify each)
```

---

## 10. One-time migration of the existing app

Do this in phases. **Do not attempt a big-bang rewrite.** Behaviour must stay identical throughout. Each phase ends with typecheck, lint, tests and build passing, and with its own commit.

### Phase 0 — Audit (no code changes)
1. Explore the repository: framework, routing, folder layout, data layer/ORM, auth, tests, existing aliases and lint setup.
2. Inventory routes/pages, server logic, database tables, shared helpers, and cross-folder imports. Find where business logic currently lives.
3. Propose a **module map**: modules, the features in each, table ownership, what goes into `platform/`, `ui/` and `front/`, and the main cross-module interactions (marked as call or event).
4. List risks: circular dependencies, cross-module joins, god-files, shared helpers that hide business logic, tables used by many areas.
5. Write this to `docs/architecture/audit.md` and **stop. Ask the user to review and approve the module map before changing any code.**

### Phase 1 — Scaffold and guardrails
1. Create the `platform/`, `ui/`, `modules/`, `front/` folders, the registry, the event bus and `app/modules.ts`.
2. Add path aliases and the boundary lint in **warning** mode, so violations are visible but non-blocking.
3. Create `docs/architecture/README.md` and `events.md` skeletons.

### Phase 2 — Move code, one module at a time
1. Start with the most self-contained module. Move files with `git mv` to preserve history. Update imports. Keep public behaviour unchanged.
2. Create the module's `index.ts`, `module.ts` and `README.md`. Replace external imports of its internals with calls to its public API.
3. Move genuinely generic code (auth, notifications, files, db) into `platform/`, and presentational components into `ui/`. Anything carrying business terms stays in a module.
4. After each module: run typecheck, lint, tests and build, then commit (`refactor(<module>): move into modular structure`). Report progress, then continue to the next module.
5. Convert cross-module side effects to events where the audit marked them as events.

### Phase 3 — Data ownership
1. Document table ownership in each module README.
2. Remove cross-module table access by routing it through public APIs or event payloads.
3. **Do not rename or alter database tables or run migrations without explicit user approval.** If prefixing tables is approved, generate proper migrations, never edit production data by hand, and do it one module at a time.

### Phase 4 — Lock it in
1. Fix the remaining boundary warnings, then switch the boundary rules to **error**.
2. Prove enforcement with the deliberate-violation check (section 8).
3. Finalise the docs, the Mermaid diagram and the ADRs for any approved exceptions.

---

## 11. Checklists for future work

### Adding a feature to an existing module
- [ ] Create `features/<feature>/` in the owning module. Keep everything for it inside.
- [ ] If it needs something from a sibling feature, move that piece to the module's `shared/`. Do not import the sibling.
- [ ] New tables are prefixed with the module name and owned by this module.
- [ ] New permissions follow `<module>.<feature>.<action>` and are registered in `module.ts`.
- [ ] Nav links are registered in `module.ts`. The route file in `app/` stays thin.
- [ ] Side effects in other modules use events, and `events.md` is updated.
- [ ] Only add to the module's `index.ts` what another module or `front/` actually needs.
- [ ] Tests exercise the feature through its entry points. Other modules are faked.
- [ ] The module README is updated.

### Adding a new module
- [ ] Confirm it's genuinely a new business area (purpose fits one sentence without "and"). If unsure, ask.
- [ ] Copy the standard module shape: `index.ts`, `module.ts`, `events.ts`, `README.md`, `shared/`, `features/`.
- [ ] Register it in `app/modules.ts`. **Adding a module must not require editing `platform/`.** If it does, something has leaked. Stop and raise it.
- [ ] The module works when other modules are disabled.
- [ ] Add it to the module map and diagram in `docs/architecture/README.md`.
- [ ] Write an ADR: `NNNN-add-<module>-module.md`.

### Needing something from another module
- [ ] Do you need an answer right now? Then add a small function to their `index.ts`. If not, listen to (or ask them to emit) an event.
- [ ] Check for a two-way dependency. If one appears, convert one side to an event.

### Moving something into the platform
- [ ] At least two modules use it today (rule of two).
- [ ] It contains no module or business terms.
- [ ] Record an ADR if it's a significant capability.

---

## 12. Definition of done (every task)

- [ ] No boundary lint errors. No new `eslint-disable` for boundary rules.
- [ ] Typecheck, lint, tests and build all pass.
- [ ] No platform code references a module, and no module touches another module's internals or tables.
- [ ] The docs touched by this change are updated (module README, `events.md`, architecture README, ADR if applicable).
- [ ] The summary to the user states which layer(s) were changed and why the code lives where it does.

## 13. How to behave

- Prefer small, reviewable steps with a commit per step over large sweeping changes.
- When a boundary decision is ambiguous, make the best call using section 7, state it in your summary, and continue. Ask only when it affects table ownership, module boundaries, or requires a rule exception.
- Never delete files, rename database tables, or run migrations without explicit approval.
- If you find existing code that breaks these rules while working on something else, don't silently refactor it. Mention it in your summary and offer to fix it as a separate change.

---

## 14. UI rule (owner rule, 10 October 2026)

Build UI with shadcn/ui themed with the app's design tokens. **Only compose existing components and existing tokens.**

- No literal colours: no hex, `rgb()`, `hsl()` or `oklch()` values. Use the `ui-` colour utilities and the `--pc-*` tokens.
- No one-off lengths: no pixel numbers and no Tailwind arbitrary values such as `w-[137px]` or `text-[#1a2b3c]`. Use the Tailwind scale and the tokens (`--pc-text-*`, `--pc-control-height`, `--pc-radius-*`, for example `rounded-[var(--pc-radius-card)]`).
- If something can't be built from existing components and tokens, **ask the user before adding a new token or component.** Never invent one to get past the lint.

Why: most "AI ugliness" comes from inconsistency, not bad taste.

`npm run lint` enforces this for `src/**/*.{ts,tsx}` with `turnfin/no-literal-styles` (`scripts/lint/design-tokens.mjs`). Tests, email templates, the browser theme colour in `src/app/layout.tsx` and the Docs content palette are exempt, because they need literal values. Existing cases waiting for a token decision are listed in `eslint-suppressions.json`. That list only shrinks: when you fix one, run `npx eslint --prune-suppressions`. Never add to it, and never disable the rule inline, without the user's approval.

The rule applies to stylesheets too. Tokens are defined only in `src/app/theme/poolside.css` and `src/app/shadcn.css`; other CSS uses them. The lint does not check CSS files yet.
