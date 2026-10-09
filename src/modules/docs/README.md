# Docs

**Purpose:** keeps the centre's controlled documents written, approved, current and read by the right people.

Docs keeps its content in its own database (`DOCS_DATABASE_URL`, migrations in `docs-database/`); staff sign-in and grants come from Turnfin. See [docs/turnfin-docs.md](../../../docs/turnfin-docs.md).

## Features
- `home` — the Docs overview: what needs this person's attention (`/docs`).
- `library` — every document a person may read, filtered and searched (`/docs/library`).
- `reader` — reading a document, acknowledging it, reviewing and approving it (`/docs/documents/[id]`).
- `editor` — a new document and editing a draft (`/docs/documents/new`, `/docs/documents/[id]/edit`).
- `history` — a document's versions and comparing them (`/docs/documents/[id]/history`).
- `work` — a person's drafts, reviews and approvals (`/docs/work`).
- `reports` — reading and review reports, on screen and as a download (`/docs/reports`, `/api/docs/reports`).
- `admin` — categories, groups, templates and settings (`/docs/admin`).
- `files` — attachments: upload and download (`/api/docs/files`).
- `import` — importing pages from Notion (`scripts/docs-import-notion.ts`).
- `me` — a person's required reading for Turnfin Me, and the overdue-reading digest. Reached through `index.ts`.
- `workspace` — the Docs frame, its menu and the access check (`src/app/docs/layout.tsx`).

`shared/` holds what two or more features use: the document service and its rules (`domain.ts`), the database and its runtime connection, types and content checks, the access check (`auth.ts`), workspace reads (`queries.ts`), report scope, the server actions every screen uses (`actions.ts`, moved from `src/app/docs/actions.ts`), and the shared components (rich editor, document body, document list, Docs UI pieces).

## Public API (index.ts)
- `docsReading()` — a person's required reading, one version of it, and acknowledging it; null while the Docs database is not configured. For Turnfin Me's staff API.
- `readingReminderItems(on)` — overdue required reading, for Turnfin Me's reminder digest.

## Data owned
In the Docs database (not Prisma): `documents`, `drafts`, `snapshots`, `reviews`, `requirements`, `acknowledgements`, `assignment_rules`, `attachments`, `attachment_blobs`, `templates`, `groups`, `member_profiles`, `settings`, `audit_events`, `storage_imports`, `workspace_lock`.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: "Add a document" for writers.
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `docs.read`, `docs.write`, `docs.approve`, `docs.manage`.

## Depends on
- Platform: auth, permissions, the staff directory (people and sites from Turnfin), the shared `.turnfin-docs` theme in `src/app/theme`.
- The shared workspace frame `ModuleShell`.
- Other modules: none.
