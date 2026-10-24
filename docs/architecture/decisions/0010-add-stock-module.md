# 0010: Add the Stock module

**Status:** Accepted (13 October 2026, Fernando asked for it; final when he merges the PR).

## Context
Fernando asked (13 October 2026) for his stock taking app Stockly (github.com/Nandui/stockly, a
separate Next.js app with its own sign-in, users, centres and database) to be ported into Turnfin
as a module like the others. A new module changes the module map, which CLAUDE.md asks the owner
to approve; his request is that approval. The rules are in [docs/stock.md](../../stock.md).

## Decision
- A new module `stock` in the Back office group, beside Purchasing: `src/modules/stock` with
  features `counts`, `products`, `compare` and `workspace`, routes in `src/app/stock`, starter page
  `/stock/overview`.
- Levels View, Count and Manage at the sites a person works at (`stock.read`, `.count`,
  `.manage`), mapped from Stockly's Viewer, Stock manager and Admin.
- Tables in the main database, prefixed `stock_` (CLAUDE.md section 5), models prefixed `Stock`
  (ADR 0002), with no relations to Core tables. Stockly's centres become Turnfin's sites; its
  users, sign-in and audit log become Turnfin's.
- It keeps its own product list rather than sharing Purchasing's: a module never imports another,
  and Purchasing's products are per supplier with prices, while Stock's are what is counted on
  the shelf. Linking the two later goes through a seam.
- Stockly's compare page was a placeholder; it is built here, quantities only.

## Consequences
Adding the module needed no change to `src/platform`. Core gained the usual catalogue entries
(three permissions, one screen, the audit module names). No other module is called, and Stock
works with every other module switched off. Stockly's own data is not copied.
