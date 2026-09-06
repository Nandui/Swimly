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
- For Swimly screens, Astryx and DESIGN.md remain the visual authority. Wireframe
  CSS and viewer assets apply only to separately requested exploratory artifacts;
  never import them into the app. Use synthetic data in those artifacts.
- Use the user's requested artifact format. Otherwise select a suitable local
  format and proceed; HTML is the default for requested interactive wireframes.
  Discover available tools before relying on a skill's example MCP names. If a
  requested external tool is unavailable, complete portable preparation and report
  the limitation; do not silently change the destination or publish elsewhere.
- Verify the changed deliverable and applicable project requirements. A suggested
  full audit is not required after every edit. Report unperformed checks honestly.

## Maintenance

`.agents/skills` is the Codex-discovered copy; the other two directories are
compatibility copies. Keep corresponding SKILL.md adaptations identical when
editing them, and check for drift before copying. `skills-lock.json` records
upstream installation provenance; its hashes are not certification of these
local adaptations. Review these adaptations after an upstream skill update.

Adapted on 6 September 2026 using the prompting sections of the official
[GPT-6 Astra guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra).
This is project guidance, not an OpenAI certification or a model/API migration.
