# Turnfin Training

Training is where LeisureWorld keeps its course catalogue, assigns training to
staff, has trainers sign off practical skills, and follows qualifications that
are about to expire. It lives in the main database and uses the platform access
model (see docs/platform-access.md): a role says what someone may do, an
assignment says over whom.

## Two surfaces

- **My training** in Turnfin Me (the staff app, docs/staff-app.md).
  Everyone's own courses. No permission is needed, and nothing there can reach
  another person's records. The learner reads the material and marks it done.
- **Training workspace** (`/training`, Poolside Clear, on the shared `ModuleShell`). The Manage
  surface for people with a Training capability. It opens for anyone with the
  Training screen and a Training capability **at any scope**, so a department
  lead's additional role opens it too. Every page then limits records to the
  people that capability covers.

## Capabilities

| Key | Lets you | Scope |
| --- | --- | --- |
| `training.manage` | Build the catalogue: create, edit, retire courses and choose the qualification each grants. Includes reading records. | Catalogue is organisation data |
| `training.assign` | Assign courses with a due date, and cancel assignments. Includes reading records. | The people the assignment covers |
| `training.records.read` | See training and qualifications. | The people the assignment covers |
| `training.signoff` | Sign off practical training, or send it back with what to practise. Never your own. Includes reading records. | The people the assignment covers |

None are restricted, so administrators hold them. Code resolves them through the
policy engine (`subjectsFor`, `requireCapFor`), never the flat session check.

## How a course works

1. A course is self-completed or needs a trainer's sign-off, and can grant a
   qualification type.
2. Assigning creates one open assignment per person and course (a partial unique
   index enforces it); people who already have it open are skipped.
3. The learner marks it done. A self-completed course is then **Completed**; a
   practical one is **Awaiting sign-off**.
4. A trainer who covers the person signs it off (**Completed**) or sends it back
   (**To do**, with a note the learner sees).
5. Completing a course that grants a qualification records it, issued today and
   expiring after the qualification type's validity. Signed-off courses are
   verified by the trainer; self-completed ones are unverified.

Statuses and their icons come from `TRAINING_STATUS_META` (and certificates from
`CERTIFICATE_STATUS_META`), shown with `<Tag meta={…} />`; "Overdue" is derived from the
due date.

## Expiring qualifications

`/training/expiring` lists qualifications that have expired or expire within 60
days for the people in scope, with the course that renews each (a course that
grants that type) and a one-click renewal assignment. A newer certificate of the
same type takes the person off the list. Turnfin Me shows each person their own and lets them upload a new certificate, which
a qualifications role checks under **Certificates to check**. Rota (phase 8) warns on expired qualifications but
does not block.

## Files

- Schema: `TrainingCourse`, `TrainingAssignment` (`prisma/migrations/20260930120000_training`)
- Access and reads: `src/lib/training/access.ts`, `data.ts` (Manage), `mine.ts` (self-service)
- Actions: `src/lib/training/actions.ts` (every change audited in its transaction)
- Self-service: `src/lib/training/mine.ts`, `self.ts` (staff API only); registry entry in `src/modules/registry.ts`
- Pages: `src/app/training/` (workspace); the learner side is Turnfin Me (`apps/me`)
- Tests: `src/lib/training/training.test.ts`
