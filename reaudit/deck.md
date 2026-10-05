# Re-audit: deck (PASSED DK-01; DK-02 fails on item 1)
1. [medium] Desk class page at 375: shared save bar overlaps the phone bottom bar by 2px (hard-coded 88px assumes a 72px bar; real bar is 82px tall at 8px from the edge). Base the offset on one token, e.g. --tf-bottom-space, used for this rule and the frame padding-bottom (104px today); target 16px gap — poolside.css:427-428
2. [low] Deck competencies trigger hint "2 of 4 achieved" inherits 600 from the h3; set .pc-row-hint font-weight 400 — poolside.css:497, deck-checklist.tsx:371
3. [low] Deck class overview: description <p> outside .pc-panel-head with max-w-prose; move it under the H2 inside the head, drop max-w-prose — class-competency-overview.tsx:11-17
4. [low] Deck assessment page back link "‹ Classes" -> "Back to classes" — instructor/assessment-session.tsx:29
