# Swimly

A calm, document-like workspace, built in the
[well-kept page](https://github.com/Nandui/seryn-design-kit-one) style.

Next.js App Router (server components by default) · Prisma 7 + Postgres · Auth.js
· Tailwind v4 with CSS-variable tokens · shadcn/ui primitives · zod.

The visual system and the conventions underneath it are documented in
[DESIGN.md](DESIGN.md). Read that before adding a page.

---

## Getting started

You need Node 20+ and a Postgres database.

**1. Environment.** Copy the example and fill in `DATABASE_URL`:

```bash
cp .env.example .env
```

`AUTH_SECRET` is already generated in your local `.env`. To make another:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**2. Create the schema.**

```bash
npm run db:migrate
```

**3. Create the first admin.** Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` and
`SEED_ADMIN_PASSWORD` in `.env`, then:

```bash
npm run db:seed
```

The seed declines to run once an admin exists, so it is safe to leave in a
pipeline. Clear the three variables afterwards.

**4. Seed a curriculum** (optional, and it declines once one exists):

```bash
npm run db:seed-curriculum
```

**5. Run it.**

```bash
npm run dev
```

Sign in at `/sign-in` with the seeded account. During development you can set
`DEV_AUTH_BYPASS=1` in `.env` instead — it signs you in as the first active
admin in the database and is ignored in production builds.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Checks the environment, generates the client, builds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (deployments) |
| `npm run db:seed` | Create the first admin, once |
| `npm run db:seed-curriculum` | Seed a starter curriculum, once |
| `npm run db:studio` | Prisma Studio |

`npm run build` fails if `DATABASE_URL` is missing and warns about a missing
`AUTH_SECRET` or an unpooled-URL mismatch, naming where to set each.

---

## The design system

It is vendored as a git submodule at `.claude/skills/design-kit`, which is also
a Claude Code skill — ask for "the house style" and it loads its own references
before writing code.

After cloning this repo:

```bash
git submodule update --init --recursive
```

To pull a later revision of the kit:

```bash
git submodule update --remote .claude/skills/design-kit
```

Swimly ships **light mode only**, by decision rather than omission. DESIGN.md
explains why and how to reverse it.
