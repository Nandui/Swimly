# 0002: Keep table names; ownership by schema file

**Status:** Accepted (9 October 2026, confirmed by Fernando).

## Context
CLAUDE.md asks for module-prefixed table names. Renaming tables is not an additive change, and AGENTS.md requires schema changes to only add, because merging to `main` migrates production under live code.

## Decision
Tables keep their names. Ownership is recorded by the file each model lives in (`prisma/schema/<module>.prisma`), and lint stops a module querying another module's tables. New tables take the module's prefix in the model name, as most already do (`Refund*`, `Training*`, `Rota*`, `Academy*`, `Task*`; Purchasing's `Supplier` is the exception).

## Consequences
No production migration. Ownership is enforced by lint rather than by name.
