# Coinage

Coinage is where the desks ask accounts for coins for their tills (coins only, no notes), and where accounts
decides and records the order (owner request, 21 October 2026; ADR 0014). It works the way
[Refunds](refunds.md) does: the same steps, the same access shape and the same staff emails. It
never orders anything itself; the order is placed with the bank or cash carrier outside Turnfin.

## The desk and accounts

1. The desk opens **Request coinage**: the site (preset when the person works at exactly one), who it
   is for (a till, desk or area), the day it is needed by, and for each coin the value in
   euro (€50 of €2 coins is 25 coins). Each value must be a whole number of that coin. The
   total adds up as they type. A draft needs only the site; sending needs who it is for, a needed-by
   day of today or later and at least one coin. Amounts are stored as whole cents per
   denomination (`lines`, keyed by the face value in cents) with the total.
2. **Save draft** keeps it private to whoever started it. **Send to accounts** shares it.
3. The list starts on what needs the person's team (accounts: waiting for review and to order; the
   desk: their requests sent back). Tiles count each queue; search finds a till, a person, an order
   reference or a CO number; site, status, handler and requester filters narrow it.
4. Accounts can **Take this on** (an assignment, not a lock) and **Approve**, **Decline** (with a
   reason) or **Ask for more information** (with a reason). Nobody decides their own request.
5. A request sent back can be changed by the desk and sent again. Every step stays in the history
   with who did it, when, the total and, on each save or send, the coins asked for.
6. An approved request shows **Awaiting order**. Once accounts has ordered it, **Record the order**
   takes the day ordered, the delivery day expected and the order reference, and closes it as
   **Ordered**. Recording it once is all; it cannot change after.
7. The desk can withdraw a request before approval; accounts can cancel an approval not yet ordered,
   with a reason.

## Access

| Permission | Enables |
| --- | --- |
| `coinage.read` | Sent requests across sites, and their own drafts |
| `coinage.request` | Drafts, sending, changing a request sent back, withdrawing |
| `coinage.review` | Taking on, approving, declining, asking for information, cancelling an approval |
| `coinage.process` | Taking on and recording the order of approved requests, cancelling an approval |

Levels: **Use** (`read`, `request`) for the desks, **Manage** (adds `review`, `process`) for accounts.
The module stays hidden until a role is given a level under **Admin > Roles**.

## Staff emails

The same as Refunds, through Core's one sender with **Turnfin Coinage** as the display name. Sending
a request emails every active person with Coinage Manage, except the requester. Asking for
information, approving, declining, cancelling and recording the order email the requester. Each
email holds only the CO number, the status and a link (`COINAGE_APP_URL`, else `REFUNDS_APP_URL`).
Jobs are saved with the step and sent after it; a failed email never loses the request, accounts
sees "We couldn’t confirm the email alert" with **Send again**, and with nobody set up to receive
it the alert waits until a role is fixed.

## Storage

The additive migration `20261129120000_coinage` creates `CoinageRequest`, `CoinageEvent` and
`CoinageNotification`. Every change locks the request, checks its version, and writes the change,
its history row, its audit row and its email jobs together. Database checks keep the statuses,
a positive total and a complete order record.

## Checks

`src/modules/coinage/__tests__/coinage.test.ts` runs the real migration in PGlite with email and
sign-in faked: amounts and validation, permissions and screens, draft privacy, retries and clashing
decisions, audit rollback, self-decision, sending back and again, approval, cancelling, recording the
order once, email recipients, failed and waiting emails, and the home card.
