# Vouchers

Owner request, 12 November 2026: at certain times of year, Christmas for one, the centre
gives vouchers for a service (usually a family swim ticket) to communities and
organisations. Turnfin tracks who got how many and which were used. A Front of house
module.

Owner decisions, 12 November 2026: every voucher has its own code; reception marks it as
used in Turnfin; Turnfin prints the vouchers; each batch names the sites that accept it.

## Words

- **Batch**: one gift of vouchers to one community or organisation (`VoucherBatch`): the
  occasion ("Christmas 2026"), who it is given to, what each voucher gives, how many, the
  first and last day they can be used, and the sites that accept them.
- **Voucher**: one code that works once (`Voucher`), numbered within its batch.
- **Occasion**: free text typed on the batch. Batches are listed and counted under it.

## Surfaces (`/vouchers`, a Work module on the shared `ModuleShell`)

- **Redeem** (`/vouchers`): the desk's page. Type a code and **Check voucher**: what it
  gives, who it was given to, when and where it can be used, and its state. **Mark as
  used** when it is valid at one of your sites. Underneath, the latest used at your sites.
  Whoever manages vouchers also sees **Mark as not used** (a mistake put right) and
  **Cancel this voucher** (lost) here.
- **Issued** (`/vouchers/batches`, Manage): every batch under its occasion, with vouchers
  given and used for the occasion and for each batch.
- **Give vouchers** (`/vouchers/batches/new`): makes the batch and a code for every voucher.
- **A batch** (`/vouchers/batches/[id]`): used, still to use, expired unused and cancelled;
  its details; every voucher, each code opening it on Redeem. **Change** edits everything
  except how many (the codes may be printed). **Cancel batch** needs a reason and stops
  its unused vouchers.
- **Print vouchers** (`/vouchers/batches/[id]/print`): a card for each voucher still to
  hand out, two to a row on paper, dashed to cut along. The browser prints it or saves it
  as a PDF.

## Rules (`src/lib/vouchers/rules.ts`, pure)

- A voucher is **Valid** from the batch's first day to its last, both included, on the
  pool's day (`today()`). Before that it is **Not valid yet**, after it **Expired**.
- **Used** wins over everything: a used voucher stays used when its batch ends or is
  cancelled. A voucher is never both used and cancelled (a database check).
- A voucher is accepted only at the sites its batch names (`siteIds`, at least one).
- Codes are eight characters, printed in two groups (`7K3M-9QXD`), from an alphabet
  without 0, O, 1, I or L, drawn with `crypto.randomInt`: about 850 billion, so a code
  cannot be guessed at the desk. What is typed is forgiven its dashes, spaces and case.
- Using a voucher claims it in one update (`redeemedAt` still empty), so two desks with
  the same code cannot both use it.
- A batch holds up to 500 vouchers; a bigger gift is two batches.

## Access

| Level | Permissions | Lets you |
| --- | --- | --- |
| Redeem | `vouchers.redeem` | Check any code; mark a voucher as used at your sites |
| Manage | `vouchers.manage` | Make, change, print and cancel batches; put a mistake right; cancel a voucher |

Reach is the person's sites. A code can be checked from any site, so reception can say
where it is accepted. Using it needs Redeem at that site. A batch shows to whoever manages
vouchers at one of its sites; changing or cancelling it needs every one of them. Putting a
used voucher right needs Manage at the site it was used at.

Every change is audited (module Vouchers): using and putting right with the site it
happened at; batches with their site when they name one, otherwise none.

## Files

- Schema: `prisma/schema/vouchers.prisma`, `prisma/migrations/20261112120000_vouchers`
  (additive: two new tables)
- `src/lib/vouchers/`: `rules.ts` (pure), `access.ts`, `data.ts`, `actions.ts`, `home.ts`
- UI: `src/app/vouchers/`, `src/components/vouchers/`; the sheet's styles and print rules
  are in `src/app/workspace/module-workspace.css`
- Tests: `rules.test.ts`, `vouchers.test.ts` (end to end on an isolated database)
- Help: "Redeem a voucher" and "Give vouchers to an organisation" (`guides-modules.ts`)

## Not built yet

A list of organisations kept between occasions (the batch form suggests names typed
before), a fixed list of services, scanning a QR code instead of typing, vouchers that
work more than once, emailing vouchers to the organisation, and a report across years.
