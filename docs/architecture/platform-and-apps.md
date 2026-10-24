# Direction: Turnfin is a platform of apps

*Owner question, 24 October 2026: "I still have so many features to add, and some of them are full apps that other organisations sell on their own. I need a direction that fits now and later, so we can add things without breaking other things." This is the answer. [jobs-and-work-layer.md](../jobs-and-work-layer.md) is one part of it.*

## The direction in one paragraph

Keep **one Turnfin**: one codebase, one deploy, one sign-in. Treat it as **a platform with apps on top**. The platform does what every app needs. Each app (Swim school, Rota, HR, Training, Incidents, Purchasing, Stock, and whatever comes next) is a sealed part with a written contract. An app can grow as big as a product someone sells on its own, but it touches the rest of Turnfin only through its contract. It can be switched on for one site first. And every change has to pass an automatic check before it can reach the live app. This is the shape Shopify runs at very large scale (one "modular monolith"), the way Odoo's apps sit on one framework, and the way Salesforce and ServiceNow host apps on one platform.

## The words

Owner decision, 24 October 2026. Each word means one thing:

| Word | Means | Examples |
| --- | --- | --- |
| **Turnfin** | The product staff use: one sign-in, Home, and the apps. ("Turnfin Work" is retired.) | — |
| **App** | One area of the business inside Turnfin. Staff open it from Home, and a role gives it a level. In code, each app is one `manifest.ts`. | Swim school, Pool deck, Rota, HR, Refunds, Purchasing, the next one |
| **Connected product** | Outside Turnfin, with its own users and its own sign-in. It talks to Turnfin only through a versioned API. | Turnfin Me, the parent app, the Academy booking site |
| **Platform** | What every app stands on (Core). | Sign-in, people and jobs, sites, access, audit, Waiting for you |
| **Module** | A code word only: the folder in `src/modules` that provides one or more apps. | `src/modules/activities` provides Swim school, Pool deck and Analytics |

An app can have more than one set of screens. The pool deck is the swim school's poolside view: its own tablet screens, the same sign-in, the same records. It stays inside Turnfin, not a connected product.

## Why not separate products or services

Splitting Turnfin into separately deployed products would not stop things breaking. It moves the breakage into the network between them, triples the deploys and logs, and makes every cross-app job (an incident that needs HR, a class that Rota must cover) slower to build. It was tried on 28 September and reversed. The contract below keeps that door open: an app that only talks through its contract, and owns its own data, can be lifted out later if there is a reason, such as selling it to another operator. HR and Docs already have their own databases.

## The layers

| Layer | What it holds | Rule |
| --- | --- | --- |
| **Platform** (Core, `src/lib`, ADR 0001) | Sign-in and devices; people, **jobs**, sites and departments; the access engine; the audit log; the event bus; **app switches**; **Waiting for you**; the email outbox; file checks; the public API toolkit | Knows *how*, never *which app*. It never imports an app. |
| **Apps** (each a `manifest.ts`, provided by a module folder in `src/modules/<id>`) | Everything one area of the business does: its screens (desk, pool deck, office), rules, data and tests | Talks to another app only through that app's contract. Works when any other app is switched off. |
| **Connected products** | Turnfin Me, the parent app, the Academy booking site | Outside Turnfin, with their own users and sign-in. They only call versioned APIs. |

## The app contract

Every app, big or small, has the same six parts. Most of them exist today.

| Part | What it says | Today |
| --- | --- | --- |
| **Description** (`manifest.ts`) | Name, group, levels, pages, log name | Every app has one |
| **Plug** (`module.ts`) | What it gives the platform: Waiting for you items, site summaries, person-file sections, listeners | Every app has one |
| **Front door** (`index.ts`) | The few functions other apps may call when they need an answer *now* | Every app has one |
| **Events** (`events.ts`) | What it announces after something happens, for anything else to react to | One event in the whole app |
| **Own data** | Its own schema file (or its own database, like HR and Docs). Other apps keep only its ids | Enforced by lint |
| **Own tests** | Its rules, its front door and its events, run with other apps switched off | Thin in several apps; the "switched off" run doesn't exist |

**The rules that stop breakage:**
1. An app never reaches into another app. It uses the front door for a question it needs answered now, and an event for "this happened". If two apps call each other both ways, one direction becomes an event.
2. Front doors and events only grow. A field or function is added, never renamed or removed in the same change. Anything that does change goes through "expand, then contract": add the new one, move the callers, then remove the old one in a later release.
3. Database changes only add (this already holds), with the same expand-then-contract steps.
4. The platform never learns an app's name. A new app means a new folder plus one line in `src/app/modules.ts`, and nothing else.

## App switches

- An app is **on**, **off** or **on at these sites** for each organisation. The setting is kept in the platform, and only a superadmin changes it, with an audit row.
- When an app is off, its pages, menu, Waiting for you items, listeners and API routes are gone, and its front door answers "not available". Other apps already have to cope with that (the swim school's member directory returns `null` when it's off).
- This is how a big new app goes live: first at one site, then everywhere. Later, it's how Turnfin is sold app by app to other operators.
- A test switches each app off in turn and runs the whole suite. This makes the pillar "tests pass with any one module switched off" true, which it isn't yet.

## The safety net (first, because nothing else is safe without it)

Today a merge to `main` deploys straight to the live app and migrates the live database, and nothing checks it automatically.

1. **A check on every pull request**: typecheck, lint (including the boundary rules), tests and a build against the development database. It runs on GitHub, and `main` accepts only pull requests that pass it.
2. **A test floor for each app**: its rules, every front-door function and every event it emits or handles. Start with the apps that have the least (Refunds, Coinage, Stock, the CCTV log, Site Monitoring, Tasks, HR).
3. **Preview before main**, as today, with the pull request's own development database.

## Order of work

1. **Safety net.** Add the pull request check, protect `main` (Fernando's yes is needed, since it changes how everyone merges), and bring each app up to the test floor.
2. **App switches** and the switched-off test run.
3. **Jobs at places**: phases 1 and 2 of [jobs-and-work-layer.md](../jobs-and-work-layer.md).
4. **Platform services**: complete Waiting for you, the email outbox and the file check (phases 3 to 5 of the same plan).
5. **Events between apps**: each cross-app side effect becomes an event when that code is next touched. `rota.shift.changed` is already listed as a candidate in [events.md](events.md). The seams that are really plugs (Waiting for you items, site summaries, person-file sections) stay plugs.
6. **New apps** follow the "Adding a new module" checklist in CLAUDE.md, plus the six-part contract above. Each one ships switched on at one site first.

## How to tell it's working

- Adding an app changes no other app's files except `src/app/modules.ts`.
- Any app can be switched off and the rest still pass their tests.
- Nothing reaches `main` without passing the checks.
- The five sentences in [how-turnfin-works.md](../how-turnfin-works.md) still explain Turnfin.
