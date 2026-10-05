# Re-audit brief (review only)

Read /home/user/audit-kit/AGENT-BRIEF.md for the sources of truth, the sandbox, accounts and tools. All 49 tasks in /home/user/audit-kit/tasks/ are applied and committed on `redesign`.

You are a RE-AUDITOR. Do NOT edit any file under /home/user/swimly, do not run git commands that change anything, do not start or stop servers. You may create records in the sandbox only through the UI with obviously fictional data if a screen needs one (the sandbox already holds seeded refunds, documents, a started class and example swim-school records).

For your area:
1. For each task id you are given, read its brief and check its acceptance criteria live (screenshots at 375 dark and 1280 light; add 768 or 1024 only where the brief's acceptance names it) and in code. List the ids that fully pass.
2. Then look for anything else in your area that does not fit Poolside Clear v2 or looks unfinished: typography, components, shapes, colour and contrast, layout and spacing, copy, states, responsive, dark mode, accessibility, and regressions. Compare with the mockups at http://127.0.0.1:4300/preview/.

Be strict but practical: the bar is a product ready to sell. Do not report things that already match the direction, matters of taste the mockups do not settle, or things the briefs deliberately left as owner decisions. Every issue needs evidence (screenshot path under /home/user/audit-kit/shots/reaudit/<area>/ and/or path:line) and a concrete fix naming the files.

Final report, in this exact shape (plain text, no preamble):

PASSED: <ids>
ISSUES:
1. [high|medium|low] <screen> :: <element>
   Observed: …
   Expected: …
   Fix: … (files: …)
   Evidence: …
2. …
COVERAGE: <one line on what you checked>
