# Interaction system

How Turnfin moves and how it answers an action, on every screen. The look is in [DESIGN.md](../DESIGN.md); this page is the motion and feedback contract it points to. Timings live in `src/app/motion.css`.

## Motion

- Feedback: 120ms for hover, press and control state changes.
- Component: 180ms for menus, popovers, tooltips and small disclosures.
- Surface: 240ms for dialogs and directional sheets.
- Spatial: 280ms, reserved for a demonstrated continuity need.
- Use the shared easing and animate only the properties that change.
- Keep rows, static cards, initial page content and route changes stationary.
- Reduced motion removes transition and animation delays and every offset, rotation and scale, while selected, loading and theme states still change at once.

### Small movements

- Buttons depress by 1px while pressed; text links and disabled controls do not. This changes paint position only, never the layout around it.
- Directory chevrons (swimmers, classes) move 2px toward the destination on hover, keyboard focus or press; the row stays still. Hover motion is limited to fine pointers.
- Checkbox and radio indicators stay mounted and fade into selection. The pool deck's attendance and competency checks do the same without changing target widths. There is no page-entry animation.
- Loading labels crossfade with a 2px offset inside their reserved cell. Only the pending layer is announced, and its spinner runs only while saving.
- The appearance control crossfades and rotates its two icons on a theme change, with one accessible label.

## Feedback

Keep context visible while an action runs. Keep the width of progress buttons, block duplicate submission, keep entered values on failure, and confirm success with a toast or the resulting view. Field errors sit beside the field; a save whose outcome is uncertain asks the person to check the record before trying again. Important guidance stays visible. Tooltips explain compact controls on hover and keyboard focus; they never replace labels or required instructions.

## Building blocks

- `LoadingButton` reserves its idle and busy labels (the hidden one leaves the accessible name), blocks duplicate submission with `aria-disabled` and a click guard so focus stays on the button, and announces the pending label in a polite live region.
- `IconButton` gives an icon-only control its accessible name and a tooltip.
- `useFormFeedback` and the field adapters tie native and server errors to their fields. A failed submission focuses the first invalid field, or the summary; correcting a field does not move focus.
- Shared shadcn controls use explicit transition properties and the timing tokens. Dialogs and sheets keep Radix focus and positioning. Disclosures fade their content without animating height. Tooltips wait 350ms.
- Sonner notifications use the same tokens; errors stay until dismissed.

## On purpose, never

No route animation, staggered lists, entrance motion on static cards, bouncing buttons or new animation library. Dense rows keep visible actions on touch rather than hover-only controls. Confirmations name the thing and the consequence, and close only after success.
