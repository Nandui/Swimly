# Turnfin 2.0: the product

*Turnfin 2.0 began on 24 October 2026. This file says what Turnfin is, who it is for, and the rules every product decision is judged against. How it is built is in [docs/architecture.md](docs/architecture.md); what is being built next is in [docs/roadmap.md](docs/roadmap.md).*

## What Turnfin is

Turnfin is the staff product for LeisureWorld's leisure centres in Cork. Reception, poolside, swim school, duty managers, trainers, HR, finance and the back office all work in it, across several sites, on shared computers, poolside tablets and their own phones.

Turnfin 2.0 is a **platform of apps**: one product, one sign-in and one set of records, with each area of the business (Swim school, Rota, HR, Incidents, Purchasing and whatever comes next) built as an app on a shared platform. An app can grow as big as a product another company sells on its own and still never break the others.

2.0 also brings a **new look and feel**, Turnfin Glass, approved on 25 October 2026 and written in [DESIGN.md](DESIGN.md).

The repository is named Swimly. That is a working name only; never show it to staff.

## Who uses it

| Who | Where | What they need from Turnfin |
| --- | --- | --- |
| Front-of-house staff (reception) | shared desk computers | find a member fast, book and move people, take requests, hand problems on |
| Poolside staff (instructors, lifeguards) | poolside tablets | today's classes and checks, big targets, one task per screen, nothing they do not need |
| Duty and centre managers | desk computers, phones | what needs them at their site today, and the day running |
| Department leads (swim school, training, HR, health and safety, finance) | desk computers | their area's work, decisions and records, for the sites and people they cover |
| Administrators | desk computers | people, jobs, sites, setup lists and the activity log, readable at a glance |
| Every member of staff, for themselves | their own phone, in **Turnfin Me** | their own training, reading, qualifications, shifts and what HR shares |
| Parents | the **parent app** | their children's classes, progress and details |
| The public | the **Academy booking site** | lifeguard and swim teacher courses to book |

Turnfin Me, the parent app and the Academy booking site are **connected products**: outside Turnfin, with their own users and sign-in, reaching Turnfin only through versioned APIs.

## The model in five sentences

1. **Apps.** Turnfin is a set of apps on one platform. Each app is one area of the business and keeps its own information to itself.
2. **Jobs.** A person holds one or more jobs; a job is a role at the sites it covers. For each app a role has a level, such as None, Use or Manage, and each level includes the ones before it.
3. **Home.** When you sign in you see Home for the job you are doing at your site: your apps, and everything waiting for you across them.
4. **Aimed at roles.** Inside an app, things can be aimed at roles: this document is for receptionists, that course is for instructors.
5. **Connected products.** Your own records are in Turnfin Me on your phone; parents and the public use their own products; all of them reach Turnfin only through its APIs.

If a new feature needs a sixth sentence to explain it, question the feature first.

Where the code is today: each person holds one role (sentence 2 arrives with "jobs at places", roadmap step 3), and Home's "Waiting for you" is not yet complete (step 4).

## The words

Each word means one thing. Use them in docs, on screen and in conversation.

| Word | Means | Never say |
| --- | --- | --- |
| **Turnfin** | the product staff use: one sign-in, Home and the apps | "Turnfin Work", "Swimly" |
| **App** | one area of the business inside Turnfin, opened from Home, that a role gives a level in | "module", "workspace", "surface" (to staff) |
| **Platform** | what every app stands on: sign-in, people, jobs, sites, access, audit, the shared services | "Core" (to staff) |
| **Connected product** | outside Turnfin, with its own users and sign-in, using only a versioned API: Turnfin Me, the parent app, the Academy booking site | "portal", "hub" |
| **Role** | a kind of job, such as Receptionist, holding one level per app | |
| **Job** | a role at some sites, held by one person | |
| **Level** | how much of one app a role opens, such as Use or Manage | |
| **Site** | one leisure centre | "club" (to staff; it is the code name) |

"Module" and "workspace" are code words only (see [AGENTS.md](AGENTS.md)).

## The pillars

The owner's nine pillars. Every proposal, plan and change is judged against them; say plainly when something goes against one, including your own work.

| Pillar | The rule that delivers it | How we check |
| --- | --- | --- |
| **Simple** | The five sentences explain Turnfin. Remove a concept before adding one. | This file still explains everything. |
| **Easy to use** | Everyone lands on Home for their job. Plain words, one task per screen, and it works on desk, tablet and phone. | A new starter finds their first task without help. |
| **Easy to manage** | A role is one row per app and fits on one screen; a person's jobs fit on one screen. | An admin can say what a person can do, where and why, by reading one page. |
| **Easy to audit** | Every change writes one entry to one shared log: who, what, which app, which record, when. | Any change can be traced with one search. |
| **Easy to train** | Home shows the job. Every level has one plain sentence, shown where it is set. | This file is enough to train a new manager. |
| **Modern** | One current technology and one design, the 2.0 design. When something is replaced, the old version is removed in the same release. | No second design, no dead screens, no retired words. |
| **Scalable** | A new site, role, job or organisation is data, not code. A new app is one new folder. | Adding a site needs no release. |
| **Clean** | Every app has the same six-part contract and never reaches into another app; lint refuses it. | Lint and the contract tests pass. |
| **Change without breaking** | Apps connect only through their contract. Contracts and databases only grow. Every app has its own tests, and nothing reaches `main` without passing the checks. | Tests pass with any one app switched off. |

## What every screen must get right

These hold whatever the 2.0 design looks like.

- **The job first.** Each screen serves one job for one kind of person. Say who it is for before changing what it does.
- **Plain words.** Staff words, not system words. No codes, ids or technical terms on screen.
- **Safe with people's data.** Show the least that does the job. Medical notes, HR records and contact details reach only the people whose job needs them (rules in [docs/apps.md](docs/apps.md)).
- **Honest states.** Every screen says what is loading, empty, failed or saved, and how to recover.
- **Shared devices.** Desk computers and tablets are shared: a person can switch in with a PIN and is signed out when idle.
- **Accessible.** WCAG 2.2 AA: keyboard reachable, visible focus, readable contrast in light and dark, targets big enough for wet hands at the pool.
- **What's new.** Anything staff will notice is explained in plain words on the What's new page in the same release ([AGENTS.md](AGENTS.md)).
