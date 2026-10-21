# 0014: Add the Coinage module

**Status:** Accepted (21 October 2026, Fernando asked for it; final when he merges the PR).

## Context
Fernando asked (21 October 2026) for "a new option for coinage request, similar to the refunds,
goes to accounts": the desks ask for coins for their tills, and accounts decides and
orders them. A new module changes the module map, which CLAUDE.md asks the owner to approve; his
request is that approval. The rules are in [docs/coinage.md](../../coinage.md).

## Decision
- A new module `coinage` ("Coinage") in the Front of house group, beside Refunds: `src/modules/coinage`
  with features `queue`, `request` and `workspace`, routes in `src/app/coinage`, starter page
  `/coinage/overview`.
- It copies Refunds' shape rather than sharing its code: a module never imports another, and a
  coinage request has no customer, receipts or payment. The same steps (draft, send, take on, ask
  for information, approve or decline, record the outcome, withdraw, cancel an approval), the same
  locked, version-checked, replay-safe and audited mutation, and the same queued staff emails.
- Levels Use and Manage everywhere (`coinage.read`, `coinage.request`, `coinage.review`,
  `coinage.process`), named like Refunds' so accounts staff get the matching pair. Not restricted,
  so administrators hold it.
- Tables in the main database: `CoinageRequest`, `CoinageEvent`, `CoinageNotification` (models
  prefixed with the module, as Refunds' are, ADR 0002), with no relations to Core tables.
- Alerts link with `COINAGE_APP_URL`, falling back to `REFUNDS_APP_URL`, so no new setting is needed.

## Consequences
Adding the module needed no change to `src/platform`. Core gained the usual catalogue entries (four
permissions, one screen, the audit module names). No other module is imported, and Coinage works
with every other module switched off.
