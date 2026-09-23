# Refunds workflow preview

Run `npx tsx scripts/refunds-preview/serve.mjs`, then open
`http://127.0.0.1:4201/refunds`.

This renders the application's actual shadcn components against its real Refunds
services and generated Prisma client in an isolated, in-memory PGlite database.
The preview applies migrations only to that disposable database. It does not
load production credentials, mutate real records or send email. Restarting it
resets the synthetic requests.

Use **Preview as** to switch between reception, finance and read-only staff.
Create and submit a draft, return it for information, resubmit, approve a reduced
amount with a reason, and record a fictional external payment. Optional receipts
are local test uploads; do not upload real customer information here.

`--build-only` rebuilds the UI while an existing preview server keeps its data.
The app's Next routing/authentication is represented by preview adapters; access
and state changes still go through the actual service and read functions.
Production receipt HTTP handlers are tested separately in `refunds.test.ts`.

Browser verification also covers keyboard focus, reduced-approval validation,
form recovery and light/dark layouts at 375, 768, 1024 and 1280px. Automated
file-picker upload was blocked by the Chrome extension's file URL setting;
the upload/download HTTP integration tests verify real receipt bytes instead.
