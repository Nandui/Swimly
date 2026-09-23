# Enrolment follow-up preview

Run `npx tsx scripts/follow-up-preview/serve.mjs`, then open
`http://127.0.0.1:4202/awaiting-enrolment`.

Uses the real queue, history component and server actions with an isolated
in-memory PGlite database, fictional swimmers and mocked staff authentication.
No live database or message delivery is available. Restarting resets the data.
Only follow-up reads/writes are enabled; enrolment actions are blocked.

- `?reader` shows staff with read-only access and rejects writes server-side.
- `?theme=dark` checks the dark appearance; default is light.
- `?q=Jamie` shows a swimmer with an empty history initially.
- `?view=moves` shows Morgan's move request with an overdue follow-up.
- `--build-only` rebuilds the preview assets without starting another database.

Browser verification: add an update, reject an empty note, preserve unsaved text
when reloading history/closing the panel, save and check the row summary, inspect
read-only history, and verify keyboard focus/Escape and 44px controls at 375,
768, 1024 and 1280px in both themes.
