# Swimly redesign prototype

A functional design preview of Reception and Poolside, built as a separate
Next.js application. It uses fictional records and shadcn/ui's Vega components
over Base UI, with the approved Figtree, blue and soft-amber direction.
Production integration waits for review of this prototype.

## Run locally

From the repository root:

```powershell
npm --prefix prototypes/redesign ci
npm --prefix prototypes/redesign run dev
```

Open [Reception](http://127.0.0.1:3100/reception) or
[Poolside](http://127.0.0.1:3100/today). The server binds to the local machine.

The preview fixes the date at Tuesday 8 September 2026, 15:20, so the same class
remains next while reviewing. Bishopstown and Churchfield both have fictional
records. The staff identity is Alex Murphy.

## Review the experience

1. In Reception, search for Ava, Leo, a contact name or a demo membership number.
   Try an unmatched search too. Select a swimmer, inspect their contact, notes,
   progress and current classes, then enrol, move or book an assessment.
2. Move Ava's 15:30 place to the later Turtles class. Try moving to the full
   Sharks class; the original place remains. A different level needs a placement
   reason. Choose **Save failure** in preview controls to verify a submitted
   form keeps its choices and text.
3. In Poolside, open Turtles. Mark attendance, switch to Competencies, then
   switch between marking one competency across the class and one swimmer's
   full checklist. Both use the same draft. Ava begins with four of five
   competencies achieved, making the explicit level confirmation easy to try.
4. Wait for saves, then select **Done taking attendance**. Saving marks alone
   does not complete attendance. Changing an attendance mark reopens it.
   Open Dolphins to try the explicit cover declaration.
5. Use **Preview controls**, above the product, to simulate slow saves, a lost
   connection, save failures, read-only permissions and another instructor's
   edit. Keep editing during a slow save. Reload with the connection lost,
   then restore it. A conflict preserves the draft and asks which version to
   keep; replacement checks the latest revision again.
6. On a phone-sized window, switch Reception between Swimmer and Today's
   classes. Selection and filters remain in place. Review both colour modes;
   the default follows the device.

Preview settings, theme, fixture changes and lesson drafts survive reloads in
this browser. Use a fresh browser profile or clear this origin's site data to
start over. Nothing here connects to real swimmer records.

## How it is organised

| Location                       | Responsibility                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| `src/app/`                     | Routes, typography, semantic colour pairs and responsive styles |
| `src/components/ui/`           | Official shadcn/ui source with app-sized touch targets          |
| `src/components/ui.tsx`        | Screen-facing action, status, tab and dialog adapters           |
| `src/components/`              | Shell and the Reception, Today and class workspaces             |
| `src/lib/demo-store.ts`        | Workspace lifetime, club context and fictional desk commands    |
| `src/lib/lesson-controller.ts` | Shared draft state, batching, revision checks and recovery      |
| `src/lib/persistence.ts`       | Fictional persistence adapter and connection simulations        |
| `src/lib/desk.ts`              | Pure enrolment, move and assessment validation                  |
| `src/lib/fixtures.ts`          | Invented swimmers, classes and competencies                     |

Draft persistence happens immediately. Autosave waits 650ms after an edit,
allows one request in flight per lesson, and retains later edits while a
request is pending. Temporary failures retry with bounded backoff. Opening a
class does not persist absent defaults. Completion is explicitly confirmed
only after pending marks save, then its own save must succeed before the UI
reports attendance complete.

The simulated server and draft have separate, versioned `localStorage` keys.
**Saved** means acknowledged by that fixture adapter, not a real service.
Conflicts use the adapter's revision check and a deterministic external-edit
simulation. This is not a multi-device synchronisation implementation.

## Verification

Run these scoped commands from the repository root:

```powershell
npm --prefix prototypes/redesign run typecheck
npm --prefix prototypes/redesign run lint
npm --prefix prototypes/redesign test
npm --prefix prototypes/redesign run test:browser
npm --prefix prototypes/redesign run build
```

Browser tests use installed Google Chrome and start a local dev server if
needed. The prototype's build script is only `next build`. Do not substitute
the repository-root production build, which runs database migrations.
See [QA.md](QA.md) for the checks completed for this deliverable.

## Production review boundary

This prototype has no database imports, API mutations, authentication or real
permission enforcement. Preview permissions exercise the UI and adapter contract.
The synthetic curriculum is shared across demo levels for reviewing the marking
interaction; it is not a replacement for Swimly's curriculum model. Swimmer
marks are held in lesson fixtures, so cross-class historical progression still
needs the real domain adapter.

After prototype review, production work must add version-checked autosaves and
persistent attendance-completion state, invalidate completion on roster or
attendance changes, and preserve named permissions, audit records, capacity
locking and additive schema changes. Integrate the whole shared shell and
operational workflows before removing production Astryx dependencies, adapters,
overrides and obsolete design instructions. Production remains unchanged apart
from excluding this isolated app from the root typecheck and lint inputs.

Full offline class loading, installability, payments and parent-facing features
remain out of scope.
