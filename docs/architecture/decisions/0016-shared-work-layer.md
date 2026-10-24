# 0016: One shared way to send work: "Waiting for you", one email outbox, one file check

**Status:** Proposed (24 October 2026), with [0015](0015-jobs-at-places.md). Phases 3 to 5 of [docs/architecture/jobs-and-work-layer.md](../jobs-and-work-layer.md).

## Context
- **Email queues:** Refunds and Coinage keep copy-for-copy email queues, and Incidents keeps a third, weaker one with no retry. Purchasing never tells approvers that an order is waiting.
- **File checks:** six modules check uploads in their own way.
- **Waiting work:** Home's "Waiting for you" is built from module home cards, but Docs reviews, parent access requests and Rota's Timepoint updates are missing from it.

CLAUDE.md section 7 puts the *how* of sending notifications and storing files in the platform, which is Core here (ADR 0001). The *when* and *why* stay in modules.

## Decision
- **No stored work items.** "Waiting for you" stays derived from each module's own records through `registerHomeCard`. Every module with waiting work reports it, and a home card never writes while it is read.
- **One email outbox in Core** (`src/lib/notify`, one `Notification` table keyed by module, ref and recipient), built from the Refunds design. Modules move one at a time. Each old table stops receiving rows and is kept for history.
- **One upload check in Core** (`src/lib/files`). Files stay in each module's own tables.
- **Comments stay in their modules.** Their shapes differ, so a shared one would add a concept rather than remove one.

## Consequences
- A new module gets alerts and upload checks without building its own.
- Rule of two: the outbox already has four users (Refunds, Coinage, Incidents, Purchasing) and the file check has six.
- Dropping the old notification tables is a later owner decision.
