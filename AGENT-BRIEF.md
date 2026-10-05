# Rules for every fix agent (cloud run, read this first)

You are fixing Turnfin in the Swimly repo at /home/user/swimly (git branch "redesign") so every screen fits the owner-approved "Poolside Clear v2" direction and the app is ready to use and sell. Work carefully and completely; this is production work, not a sketch.

Sources of truth: /home/user/swimly/DESIGN.md ("Poolside Clear v2 system rules" and the frame description), src/app/docs/poolside.css, and the approved mockups at http://127.0.0.1:4300/preview/<Name>.html (files in /home/user/audit-kit/mockups/preview/; V2System is the component sheet; V2*, SS*, Deck*, RF*, DC*, TR*, HR*, RO*, AD*, AU*, HP*, Me* are pages; "-menu" variants show the open account menu). The repo's AGENTS.md rules apply (named permissions, audit rows, metadata-fed tags, import boundaries enforced by npm run lint, Work vs Me separation, Instructor isolation). This Next.js version differs from your training data: read the relevant guide in node_modules/next/dist/docs/ before using an API you are unsure of.

Your task brief: /home/user/audit-kit/tasks/<ID>.md (problem, original change, amendments from verification which take precedence over the original change, acceptance, verification notes). If the brief's line numbers no longer match the code, follow the brief's intent against the current code.

Live check: the sandbox at http://localhost:3100 (in-memory fictional data; Next dev with hot reload, so edits show on reload). Accounts, password sandbox-turnfin-2026: alex@sandbox.invalid (superadmin), maya@ (duty manager), ava@ (instructor), liam@, noah@, riley@sandbox.invalid.

Tools (bash):
- Screenshots: cd /home/user/audit-kit/tools && node cdp-shoot.mjs <outDir> <email> <password> "/path@375@dark" "/path@768@light" "/path@1024@dark" "/path@1280@light". Signs in, saves full-page PNGs, prints {over, clipped, small} checks. Mockups: BASE=http://127.0.0.1:4300 node cdp-shoot.mjs <outDir> "" "" "/preview/V2System.html@1280@light".
- Links (record ids): node /home/user/audit-kit/tools/cdp-links.mjs x <email> <password> /students /courses
- Use outDir /home/user/audit-kit/shots/fix/<your-task-id>. Read PNGs with the Read tool; crop/zoom with python PIL for detail.

HARD RULES (other agents may be editing this same working tree at the same time):
- Edit existing repo files ONLY with the Edit tool (targeted string replacements). Never rewrite an existing file with Write, python, sed or any script. If an Edit fails because the file changed, Read it again and redo the edit. Write is fine for brand-new files. Deleting a file is fine when your task says so (rm), after grepping that nothing imports it.
- Do NOT run git commit, checkout, stash, reset, restore, rebase or push. The gate commits after each stage.
- Do NOT edit prisma schemas or migrations, run seeds, or touch any database other than browsing the local sandbox. Do not start or stop servers on ports 3100/4300. Do not create records in the sandbox unless your brief needs them, and then only with obviously fictional data through the UI.
- npm run typecheck / lint may show errors in files other agents are editing. Fix every error in files your task touches; ignore transient errors elsewhere. Run: cd /home/user/swimly && npx tsc --noEmit -p . ; npx eslint <your files>.
- Keep docs that describe what you change accurate (DESIGN.md sections your task names, docs/*.md), using Edit.
- Prefer removing a concept or reusing a shared part over adding a new one. No hard-coded colours or sizes; use tokens. Status colour only through metadata maps with icons. Sentence case. 44px targets. Both themes. 375/768/1024/1280 with no overflow, clipping or content hidden in a scroll.
- Before finishing, verify visually: screenshot the acceptance routes live at the widths/themes the brief names and compare with the mockup; fix what does not match.

Final report (your last message), short and honest:
- ID and status: done / partial / blocked
- Files changed
- What changed (a few lines)
- How you verified it (commands, screenshot paths)
- Anything left open
