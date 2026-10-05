# Re-audit: training-hr-admin (PASSED TR-01, HR-01, AD-01, AD-02)
1. [medium] /staff at 375: actions stacked vertically (~170px rows), avatar hidden, role without Tag; actions in one horizontal .pc-row-trail line under the body (as Organisation/Sites), keep avatar — (core)/staff/page.tsx:186, 225-226
2. [low] /training filter Show and Course selects fixed at 160px clip labels; sm:basis-auto sm:min-w-52 or size to content — training/page.tsx:57,62
3. [low] HR draft footer "only you can see it" untrue for superadmins/non-reviewers; pass isReviewer and choose the caption ("only the reviewer and superadmins can see it" otherwise); same in the Start-a-review dialog — hr/actions.tsx:77,130; hr/reviews/[id]/page.tsx
4. [low] /account extra line "Can cancel classes: The duty manager page: …" — render "{label} · {help}" and reword the registry help ("Cancel today's sessions on the duty manager page and pass them to billing") — account/page.tsx:100; modules/registry.ts:122
5. [low] Account frame comments claim an "Account" pill that SYS-14 hides; update comments to "no page bar; the H1 names the page" and drop unused links — home/home-shell.tsx:13-16,33; app/account/layout.tsx:11-14
6. [low] /staff/[id] Manager and "Manages" inline links ~20px; inline-flex min-h-11 -my-3 items-center — (core)/staff/[id]/page.tsx:52,90
7. [low] HR person absence rows: add UserX .pc-tile-icon; caption "Reported by X · note" (not ":") — hr/people/[id]/page.tsx
