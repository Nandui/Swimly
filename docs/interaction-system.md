# Interaction system

## Audit and rollout

Inspected the Next.js 16 / React 19 app, installed shadcn/Radix controls,
Tailwind Neutral tokens, `tw-animate-css`, Sonner, native form adapters and
server action results before making changes. No new animation library is needed.

| Area | Existing behaviour | Targeted improvement |
| --- | --- | --- |
| Shared controls | Mixed default timings, `transition-all`, instant tooltips; sheets enter over 500ms | Named timing tokens, explicit properties, delayed tooltips, shorter spatial transitions |
| Navigation | Labelled controls; several icon actions use native titles; site switch failures can throw without feedback | Keyboard tooltips and contained switch feedback |
| Swimmers and profile | Useful filtered empty states and retained failed forms; changing save widths; server validation is only a summary | Stable progress buttons, field errors, focus on errors and confirmation steps |
| Classes | Good filter recovery and no-level guidance; creation has the same form gaps | Reuse form/progress patterns; preserve filters and layout |
| Today | Availability icons, a visible legend and place counts; refresh keeps schedule visible | Retain the visible availability guidance; match keyboard/hover feedback; explain assessment-only days |
| Instructor | Recorded starts, shared teaching access, saved attendance, offline drafts and conflict protection | Stable save/start controls; preserve permission, dated-start and workspace checks |
| Assessments, Together and setup | Shared form/confirmation actions, mostly helpful empty states | Apply shared feedback; address only specific gaps found in each screen |
| Account/sign-in | Native validation and local failures | Consistent progress and local field guidance |

## Motion contract

- Feedback: 120ms for hover, press and control state changes.
- Component: 180ms for menus, popovers, tooltips and small disclosures.
- Surface: 240ms for dialogs and directional sheets.
- Spatial: 280ms, reserved for a demonstrated continuity need.
- Use the shared easing and animate only the properties that change.
- Keep rows, static cards, initial page content and route changes stationary.
- Reduced motion removes transition/animation delays and nonessential movement.

### Microinteractions

- Buttons depress by 1px while pressed; text links and disabled controls do not.
  This changes paint position only, never the surrounding layout.
- Swimmer and class directory chevrons move 2px toward the destination on
  hover, keyboard focus or press. The record itself stays still. Hover motion
  is limited to devices with a fine pointer.
- Sidebar navigation uses a dedicated Neutral hover surface, because muted and
  the inset canvas share the same light colour. Keyboard focus receives the
  same highlight and 2px icon response. The current page keeps its distinct
  soft blue surface and inset border. Search, site, account, Setup and collapse
  controls receive the same highlight, including in the mobile drawer.
- Checkbox and radio indicators stay mounted and fade/settle into selection.
  Instructor attendance/competency checks use the same treatment without
  changing target widths. There is no initial page-entry animation.
- Loading labels crossfade with a 2px offset inside their reserved grid cell.
  Only the pending layer is announced, and its spinner runs only while saving.
- The appearance control crossfades and rotates its two icons to acknowledge
  a theme change. It keeps one accessible action label.
- Reduced motion removes these offsets, rotations and scaling entirely while
  retaining immediate selected, loading and theme states.

## Feedback contract

Keep context visible while an action runs. Preserve the width of progress buttons,
disable duplicate submission, retain entered values on failure, and acknowledge
success with the existing toast or the resulting view. Field errors belong beside
the field; uncertain saves must ask the user to check the record before retrying.
Important guidance stays visible. Tooltips explain compact controls on hover and
keyboard focus, never replace labels or required instructions.

## Applied changes

- Shared shadcn controls use explicit transition properties and timing tokens.
  Dialogs and sheets retain Radix focus/positioning behaviour. Disclosures fade
  their content without animating layout height. Tooltips wait 350ms.
- `IconButton` supplies an accessible name and tooltip. Theme, compact actions,
  sidebar controls and icon form triggers reuse the guidance pattern.
- `LoadingButton` reserves idle and busy labels, disables duplicate submission
  and exposes progress. Creation, profile, teaching, confirmation and account
  forms use it without replacing their surrounding content.
- `useFormFeedback` and the field adapters associate native/server errors with
  their fields. A failed submission focuses the first available invalid field
  or the summary; correcting a field does not move focus. Swimmer, class and
  password actions return field metadata while keeping their existing guards.
- Swimmer/profile and class dialogs retain entries on failure and through
  confirmation. Unconfirmed saves explain how to check the outcome before
  retrying. Profile competencies explain why saving is disabled.
- Instructor attendance/competency choices keep their width when selected.
  Start, save, refresh and completion use shared progress feedback. Ownership,
  permission, audit, draft and conflict checks are unchanged.
- Today explains where assessments appear when no weekly classes are shown.
  Together pagination has distinct visible labels. Site-switch failures stay
  contained and successful changes receive feedback.

## Preserved decisions

Filtered Swimmers/Classes empty states already offer recovery; setup and
assessment empty states already explain the next action. Their wording and
layout remain. Archive confirmations already name the object and consequence;
they keep those safeguards and close only after success. Dense rows keep
visible actions on touch rather than introducing hover-only controls.

No route animation, staggered lists, entrance motion on static cards, bouncing
buttons or new animation dependency. The 280ms spatial token is reserved, not
used without a concrete continuity need. Today's availability is already
explained visibly, so it does not acquire redundant tooltip focus stops.

## Verification — 13 September 2026

- `npm run typecheck`, `npm run lint`, `npx next build` and the three
  `src/lib/action-result.test.ts` checks passed. The build ran directly, without
  the repository's deployment/migration wrapper.
- Synthetic browser fixtures exercised required and server field errors,
  retained values, first-error focus, focus staying in the field being edited,
  keyboard tooltips, dialog focus restoration, confirmation/back/confirm,
  failed archive recovery and successful saves.
- Swimmer save width was identical before/during submission. Instructor
  competency choices retained identical widths after selection. Failed
  attendance preserved marks; successful attendance advanced to competencies,
  and saving marks exposed the completion link.
- Form dialogs were checked at 375, 768, 1024 and 1280 in light/dark mode.
  Instructor checks covered those widths in light mode and mobile dark mode;
  controls remained 44px tall, with no horizontal overflow or desk navigation.
- Computed button/dialog timings were 120ms/240ms with the shared easing.
  A synthetic fixture applied the app's exact reduced-motion rules: durations
  reduced to 0.01ms, delays to zero, and focus restoration still worked. This
  verified the rules without changing the operating system's motion preference.
- A read-only check of the running `/students` page confirmed the shared form
  and timing changes. Mutation checks used stubbed actions and synthetic data;
  no shared-database test records or real account credentials were used.

This is targeted interaction verification, not a full screen-reader or formal
contrast audit of every page.

### Follow-up motion verification

Keyboard checkbox/radio selection, attendance choices, theme changes and a
synthetic save all retained their behaviour. The save button measured 163.65px
before, during and after progress. The directory cue reached 2px on keyboard
focus while its row had no transform. Synthetic light/dark checks at 375, 768,
1024 and 1280 found no overflow; attendance targets stayed 44px tall.

The reduced-motion fixture confirmed no translation, scaling or rotation,
with correct mark/icon visibility and immediate state transitions. These checks
use the production components and styles with stubbed data/actions; they do not
change real records or the operating system's motion preference.
