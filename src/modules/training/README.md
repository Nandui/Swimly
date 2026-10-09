# Training

**Purpose:** makes sure staff get the training and qualifications their jobs need.

The rules for courses, assignments, sign-offs and certificates are in [docs/training.md](../../../docs/training.md).

## Features
- `courses` — training courses: create, change, archive, and the qualification each grants (`/training/courses`).
- `assignments` — assigning training, following and cancelling it, and one person's training (`/training`, `/training/people/[id]`).
- `sign-off` — practical sign-offs: confirming a skill shown in person, or returning it for practice (`/training/sign-off`).
- `certificates` — checking certificates people upload in Turnfin Me (`/training/certificates`).
- `expiring` — qualifications expired or due soon (`/training/expiring`).
- `me` — a person's own training for Turnfin Me: their list, completing it, and the reminder digest. Reached through `index.ts`.
- `person-file` — Training's part of a person's file and their records for HR's subject export.
- `workspace` — the Training frame, its menu and the access check (`src/app/training/layout.tsx`).

`shared/` holds what two or more features use: statuses and states (`constants.ts`), the access check (`access.ts`), courses and the people a trainer may see (`data.ts`), granting a qualification on completion (`grant.ts`), write helpers (`writes.ts`) and the dialogs' kit.

## Public API (index.ts)
- `myTraining(userId)` — a person's own training, for Turnfin Me's staff API.
- `completeTrainingFor(person, id, note)` — a person completes their own training from Turnfin Me.
- `trainingReminderItems(on)` — training due soon, for Turnfin Me's reminder digest.

## Data owned
Declared in `prisma/schema/training.prisma` (table names kept, ADR 0002):
- `TrainingCourse` — a course and what it grants.
- `TrainingAssignment` — one person's assignment, from assigned to completed or cancelled.

Training also reads and writes Core's qualification records (`Qualification`, `QualificationEvidence`, `QualificationType`) and reads `User`, `Club` and `Position`. Qualifications are Core's (ADR 0001); moving these reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: practical sign-offs, certificates to check, qualifications expiring.
- Person file section `training.open` and subject records `training` (HR's export).
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `training.manage`, `training.assign`, `training.records.read`, `training.signoff`; `qualifications.manage` (Core's) for certificates and expiring qualifications.

## Depends on
- Platform: the policy engine (people a trainer may see), audit, the database client, contributions (home card, person file, subject records).
- Core reads (never Core tables; enforced by the boundary lint): people, positions and sites through `src/lib/directory.ts`; qualifications, qualification types and uploaded certificates through `src/lib/qualifications.ts` (granting goes through `recordQualification`); the person's record through `src/lib/people/records.ts`.
- The shared workspace frame `ModuleShell`.
- Other modules: none. HR reads Training's records through the `subjectRecords` seam.

## Known gaps
- `src/app/training/certificates/[id]/file/route.ts` serves the file itself (through Core's `certificateFile`) rather than through the `certificates` feature.
