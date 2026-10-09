# 0001: Core is the platform, business terms included

**Status:** Proposed (9 October 2026), awaiting Fernando's confirmation.

## Context
CLAUDE.md says the platform carries no business terms. Turnfin's Core holds sites, departments, positions and qualifications, which every module uses and which roles and permissions depend on, and its admin screens (people, roles, sites).

## Decision
Core becomes the platform as it is, with these shared business entities and their admin screens. No separate "core" module.

## Consequences
Modules keep reading people and sites from one place (`src/lib/directory.ts`). The platform rule is relaxed for these entities only; anything module-specific still may not enter the platform.
