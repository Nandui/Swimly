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
- For Swimly screens, shadcn and DESIGN.md remain the visual authority. Wireframe
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

All 13 skills from Leonxlnx/taste-skill were added on 11 October 2026 and are kept
unmodified. `design-taste-frontend` is the main one; its own scope is landing pages
and portfolios, not dashboards or product UI, so it fits the public Academy booking
site and marketing-style pages most, but its judgement checks (reading the brief,
AI tells, copy self-audit, empty, loading and error states, contrast, one accent,
no em-dashes in UI copy) apply to any screen. The others:

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
- `design-taste-frontend-v1`: the old version, for reference only.

**They may overrule** the house style in [DESIGN.md](DESIGN.md) and the UI rule in
[CLAUDE.md](CLAUDE.md) section 14 where they are the better call for the screen
(Fernando, 11 October 2026). When one does, say which rule it overrode and why in
the change summary. Where they agree, or a skill's advice is only a generic
default, keep the house style:

- shadcn/ui from `src/components/shadcn` with Poolside Clear tokens, Plus Jakarta
  Sans, the fin's blue accent and the existing radii. Their font picks (Geist,
  Satoshi), palette families, icon libraries (they discourage `lucide-react`, which
  the app uses) and other design systems (Fluent, Carbon, Material) are generic
  defaults, not reasons to switch.
- The token lint still runs. Their sample classes (`max-w-[1400px]`, `text-[11px]`,
  `leading-[1.1]`, `min-h-[100dvh]`, `shadow-[inset…]`, `tracking-tighter`) fail it
  or DESIGN.md's type check. Where a skill's value is worth keeping, add it as a
  `--pc-*` token in `src/app/theme/poolside.css` and name the new token in the
  summary rather than writing a literal.
- New packages (Motion, GSAP) and external image hosts (Picsum, the Simple Icons
  CDN) still need Fernando's go-ahead; never ship real swimmer data or photos.

## Maintenance

`.agents/skills` is the Codex-discovered copy; the other two directories are
compatibility copies. Keep corresponding SKILL.md adaptations identical when
editing them, and check for drift before copying. `skills-lock.json` records
upstream installation provenance; its hashes are not certification of these
local adaptations. Review these adaptations after an upstream skill update.

Adapted on 6 September 2026 using the prompting sections of the official
[GPT-6 Astra guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra).
This is project guidance, not an OpenAI certification or a model/API migration.
