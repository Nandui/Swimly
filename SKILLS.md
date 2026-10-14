# Local skill operating guidance

These project adaptations apply to the Intent skill copies in `.agents/skills`,
`.claude/skills` and `agent/skills`. Read this once when using a local skill.
They take precedence over the generic workflow and presentation recipes in those
skills and their references. User instructions and host rules retain the priority
defined in [AGENTS.md](AGENTS.md).

- Start with the relevant facts already in [PRODUCT.md](PRODUCT.md),
  [DESIGN.md](DESIGN.md), the conversation and current code. Context questions
  are prompts for finding material gaps, not a questionnaire required before work.
  State consequential assumptions; keep working on routine, reversible choices.
- Choose only the capabilities and references needed for the requested outcome.
  Skill-family links are optional routing aids, not automatic invocations or
  permission to spawn agents. Output templates are examples for full engagements,
  not required sections for a small fix. Do not add a research study, scoring
  exercise, ethical checklist or storytelling pass without a task-specific reason.
- A finding can justify revisiting an earlier decision within the authorized task.
  Ask only if resolving it needs a material scope decision or missing authorization.
  Stop repeating an approach when it produces no new evidence; report the concrete
  blocker and finish unaffected work. There is no fixed number of skill transitions.
- If the task includes implementation, continue after a design skill finishes.
  Its scope boundary is a handoff to the implementation work, not an early exit.
- Use concise, outcome-first prose. Explain decisions with observable evidence;
  label hypotheses and estimates. Do not invent research, metrics or user quotes.
  Do not print invocation banners or narrate a reasoning protocol.
- For Swimly screens, the taste skills lead on visual design (see below); shadcn and
  DESIGN.md are the default where they have no opinion. Wireframe
  CSS and viewer assets apply only to separately requested exploratory artifacts;
  never import them into the app. Use synthetic data in those artifacts.
- Use the user's requested artifact format. Otherwise select a suitable local
  format and proceed; HTML is the default for requested interactive wireframes.
  Discover available tools before relying on a skill's example MCP names. If a
  requested external tool is unavailable, complete portable preparation and report
  the limitation; do not silently change the destination or publish elsewhere.
- Verify the changed deliverable and applicable project requirements. A suggested
  full audit is not required after every edit. Report unperformed checks honestly.

## Taste skills (Leonxlnx/taste-skill)

All 14 skills from Leonxlnx/taste-skill are kept unmodified (added 11 October
2026, updated 13 October 2026). `design-taste-frontend` is the main one. Since
13 October it is tasteskill v2: art direction for public web pages, built on a
study of 247 gallery sites, with Node scripts in its `scripts/` folder. `draw.mjs`
deals a direction from its library, `assets.mjs` searches open image collections
(Openverse, Wikimedia Commons, the Art Institute of Chicago, the Met, the Internet
Archive, NASA), `lint.mjs` and `inspect.mjs` check a page, the last one in headless
Chrome at three widths. They install nothing, need Node 22+, and write their working
files to `.taste-skill/` (ignored by git) and a draw history to `~/.taste-skill/`.
Its own scope is public pages, not dashboards or app screens, so it fits the
public Academy booking site and marketing-style pages; its house rules (no cards,
no thin rules, no small caps labels, at least four real pictures) are written for
those pages, not for the staff app. Its judgement checks (reading the brief, AI
tells, the copy deck, contrast, one accent, looking at screenshots) apply to any
screen. The others:

- `design-taste-frontend-v2-experimental`: the previous main skill, the single-file
  dial-driven version. `design-taste-frontend-v1`: the original. Reference only.
- Style directions: `high-end-visual-design` (soft, premium), `minimalist-ui`,
  `industrial-brutalist-ui` and `gpt-taste` (GSAP-heavy landing pages). Use one
  only when the brief asks for that look.
- `redesign-existing-projects`: audit-first upgrade of an existing screen.
- Image work: `imagegen-frontend-web`, `imagegen-frontend-mobile`, `brandkit` and
  `image-to-code` generate reference images, so they need an image tool and
  synthetic content only.
- `stitch-design-taste` writes a DESIGN.md for Google Stitch. Write it under a new
  name or folder; never overwrite Swimly's [DESIGN.md](DESIGN.md).
- `full-output-enforcement`: complete, untruncated code output.

Found pictures from `assets.mjs` keep their credit and licence, and never show real
swimmers, staff or medical details.

**The taste skills lead on visual design** (Fernando, 13 October 2026). Where one
gives direction, follow it over the house style in [DESIGN.md](DESIGN.md) and the
Poolside tokens: its fonts, palettes, literal values, icon libraries, motion
packages and image sources are allowed. The tokens and shadcn components stay the
default only where no skill has an opinion. Say in the change summary which skill
set the look. Accessibility (visible focus, 44px targets, contrast), permissions,
audit and keeping real swimmer data out of designs still apply.

## Maintenance

`.agents/skills` is the Codex-discovered copy; the other two directories are
compatibility copies. Keep corresponding SKILL.md adaptations identical when
editing them, and check for drift before copying. `skills-lock.json` records
upstream installation provenance; its hashes are not certification of these
local adaptations. Review these adaptations after an upstream skill update.

Adapted on 6 September 2026 using the prompting sections of the official
[GPT-6 Astra guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra).
This is project guidance, not an OpenAI certification or a model/API migration.
