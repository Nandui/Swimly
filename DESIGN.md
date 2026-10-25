# Turnfin 2.0: the design

**Status: open.** Turnfin 2.0 gets a new look and feel. It is being explored now and is **not approved**. This file becomes the design contract, the one design for every screen in Turnfin, Turnfin Me and the Academy booking site, once the owner approves a direction. Until then it holds only the process and what applies meanwhile.

The current theme (`src/app/theme`, `src/app/shadcn.css`) is the pre-2.0 look. It keeps the live app working and is replaced, not extended.

## How the design is decided

1. **Explore** on the design canvas (https://claude.ai/artifact/8UxBBAaWSmmfhA9oqwkSRS), as mockups of real screens with synthetic data: Home, an app's frame, a list with a detail, a form, the pool deck on a tablet, Turnfin Me on a phone. New ideas are new rows; earlier rows stay for comparison.
2. **Look before showing.** Render every mockup and screenshot it at phone, tablet and desktop widths in light and dark before anyone reviews it.
3. **The owner approves** one direction. Nothing visual is built before that.
4. **Write the contract here**, replacing this placeholder: principles, tokens (colour, type, space, radius, depth, motion) for light and dark, the frame and navigation, the page shell, components, states (loading, empty, error, saved), forms and confirmation, the pool deck's tablet rules, Turnfin Me's phone rules, accessibility, and a screen checklist.
5. **Build it** as roadmap step 5 ([docs/roadmap.md](docs/roadmap.md)): theme and UI kit first, then Home and the app frame, then each app, removing the old look as each part is replaced.

## What applies until the contract is written

- **The screen rules** in [AGENTS.md](AGENTS.md) ("Screens"): they are about consistency and hold for any design.
- **What every screen must get right** in [PRODUCT.md](PRODUCT.md): the job first, plain words, safe with people's data, honest states, shared devices, accessibility.
- **No new visual ideas in the old look.** A change before the contract reuses the existing components and tokens as they are. Do not add tokens, restyle components or start the new look piecemeal in the live app.
