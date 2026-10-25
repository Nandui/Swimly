# Turnfin 2.0 docs

Every doc, once. Each fact lives in one place and the others link to it. Add a new doc here in the same change.

| Doc | Holds | Read it when |
| --- | --- | --- |
| [../PRODUCT.md](../PRODUCT.md) | what Turnfin is, who uses it, the five sentences, the words, the pillars, what every screen must get right | always, first |
| [../AGENTS.md](../AGENTS.md) | the rules for changing the code, for people and every coding agent | always, before any change |
| [architecture.md](architecture.md) | the platform, layers, app contract, how apps talk, the event catalogue, access, sign-in, platform services, connected products, databases, known gaps | before any change to code |
| [apps.md](apps.md) | every app: purpose, levels, reach, data, connections; the rules that protect people | working on an app or on access |
| [roadmap.md](roadmap.md) | the 2.0 steps in order, each with "done when"; the owner's open decisions | choosing or planning work |
| [operations.md](operations.md) | environments, running it, migrations, scheduled jobs, every setting, record management, production scripts | databases, deploys, settings |
| [decisions.md](decisions.md) | the decisions 2.0 stands on, and how to add one | before changing something fundamental |
| [../DESIGN.md](../DESIGN.md) | the 2.0 design, Turnfin Glass: principles, tokens, frame, components, motion, states, forms, accessibility, how it is built, the screen checklist | before any visual change |
| [parent-api.openapi.json](parent-api.openapi.json) | the parent app's API contract | changing `/api/parent/v1` |
| [../CHANGELOG.md](../CHANGELOG.md) | what changed for staff, release by release (shown at `/whats-new`) | shipping something staff will notice |

Next to the code: each module's `src/modules/<id>/README.md` lists its features, front door, tables, events, permissions and dependencies.
