# Re-audit: refunds-docs (PASSED DC-01, DC-03)
1. [medium] /refunds at 375: first row starts under the bottom bar (y=834 vs bar 722). Below sm: compact tiles (icon+figure one line, label beside, no caption, ~72px) and header action as inline pill, not full width — refunds/queue.tsx; poolside.css .pc-stats phone rule
2. [medium] Docs editor at 1024 scrolls sideways (sr-only file Input keeps w-full, 1024px wide): drop zone position:relative and className="sr-only w-px", or reuse FileField's hidden-input pattern — docs/document-editor.tsx:388-390; docs.css .editor-drop-zone
3. [medium] Refund request page at 375: 3 summary tiles in 2 columns leave an orphan and "Not recorded" wraps; one column below sm (or auto-fit minmax(min(100%,220px),1fr)) — refunds/detail.tsx:68; poolside.css:537
4. [low] Refund open tile edge is 1px; make it inset 2px var(--pc-primary) (DESIGN.md:384); tile aria-current="true" not "page" — poolside.css:543; refunds/queue.tsx:72
5. [low] Docs library and reports at 375: filters push results far down; put Facility/Team/Sort and report selects behind a "Filters (n)" disclosure below sm, as refunds queue.tsx:84-86 — docs/library.tsx, docs/reports.tsx
6. [low] Docs reader at 375: "On this page" rail below the whole document; hide it below 768 (V2PhoneDocument), meta grid auto-fit without orphan — docs/reader.tsx; docs.css reading layout
7. [low] Core imports Docs: session-forms.tsx:10 imports Avatar from @/components/docs/ui; use shadcn Avatar/AvatarFallback/initials as account-menu.tsx does; inline in docs/admin.tsx:181 and delete Avatar from docs/ui.tsx:64-77
8. [low] Docs admin People at 375: pencil fixed top-right, tags wrap in the body — docs/admin.tsx ~181-195
9. [low] Reading reports copy: caption "Across all current assignments"; phone title ink semibold (not brand blue); one empty-date word "Not set" — docs/reports.tsx ~97-110, 237-239
10. [low] Refunds default view named two ways; make statusLabel.actionable match "Needs my team’s action" — refunds/queue.tsx:24-26, 63
11. [low] Docs overview Facility filter: inline pill picker (label inside trigger) like Refunds; mute zero figures in Collections; hide "0 documents" caption in My work — docs/ui.tsx FilterSelect; docs/home.tsx ~138; docs/work.tsx
