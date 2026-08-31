# Menu

## Online device sync

An optional online-only account mode is now available. See [CLOUD_SETUP.md](CLOUD_SETUP.md)
for Supabase configuration, local-data migration, conflict behavior, and the
two-device acceptance checklist. Without cloud configuration, the local behavior
described below remains unchanged. In cloud mode, import/reset affect every device.

A desktop-first personal productivity system laid out like a premium
single-player RPG menu.

It is not a to-do app wearing a costume. The information architecture, the
progress systems, the unlock rules and the state model are the product: skills
form a real `Domain → Branch → Node` graph with derived levels, abilities gate
on skill requirements plus evidence, quests pay XP exactly once into an
append-only ledger, and the character sheet is entirely derived from all of it.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. On first launch you choose **Start with
sample data** or **Start empty**.

---

## Contents

- [Scripts](#scripts)
- [The five screens](#the-five-screens)
- [Architecture](#architecture)
- [The progression model](#the-progression-model)
- [Daily Quests](#daily-quests)
- [Data model](#data-model)
- [Persistence, export and import](#persistence-export-and-import)
- [Design system](#design-system)
- [Responsive behaviour](#responsive-behaviour)
- [Icons](#icons)
- [Background artwork](#background-artwork)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Extending it](#extending-it)
- [Deliberately not in version one](#deliberately-not-in-version-one)

---

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server on port 3000                       |
| `npm run build`     | Production build                              |
| `npm start`         | Serve the production build                    |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run lint`      | ESLint via `next lint`                        |
| `npm test`          | Vitest, single run                            |
| `npm run test:watch`| Vitest in watch mode                          |
| `npm run icons`     | Rebuild `public/assets/icons` from the masters |

**Stack.** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS ·
Zustand + `persist` · Zod · Recharts · lucide-react.

---

## The five screens

| Route         | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `/quests`     | The Quest Log: the Daily Quests group, quest list and filters, the selected quest, and a today / daily-progress / deadlines summary |
| `/skills`     | `Domain → Branch → Node` navigator with a connected skill tree              |
| `/abilities`  | Ability paths, a card catalogue, and a requirements / proof inspector       |
| `/inventory`  | Money, physical possessions, locations and the current loadout              |
| `/character`  | Derived attributes, radar chart and the data controls                       |
| `/map`        | A deliberate placeholder — see the last section                             |

`/character` is reached through the profile icon at the top right, not through
the five text routes. On that page none of the five is marked active; the
profile icon carries the state instead.

---

## Architecture

The dependency direction is strictly one way:

```
  src/domain/     pure TypeScript. No React, no storage, no framework.
       ↑
  src/store/      Zustand state + a persistence adapter.
       ↑
  src/components/ presentation
  src/app/        routes
```

`src/domain` never imports from `store`, `components` or `app`. That is what
makes the XP rules testable in plain Node and what makes swapping localStorage
for a database a one-file change.

```
src/
  domain/               the rules, as pure functions
    types.ts            every persisted model
    progression.ts      XP curves, ranks, node levels, ledger roll-ups
    activities.ts       activity formulas -> XP
    quests.ts           quest progress, XP splitting, deadlines
    abilities.ts        requirement evaluation and status derivation
    attributes.ts       the six derived character attributes
    inventory.ts        asset totals and money formatting
    ids.ts              id generation, timestamps, date helpers
    seed/               sample data, authored by level rather than by XP
  store/
    persistence.ts      the storage boundary (see below)
    useAppStore.ts      state + every action
    selectors.ts        derived read models as hooks
  components/
    ui/                 GamePanel, GameButton, ProgressBar, StatusBadge,
                        Modal, Tabs, IconTile, EmptyState, DetailPanel, NavList
    layout/             AppShell, TopNavigation, BackgroundLayer,
                        ResponsiveStage, OnboardingGate, StorageRecovery
    quests/ skills/ abilities/ inventory/ character/
  app/                  one folder per route
```

### The panel chassis

Every screen is the same object at different widths. `GamePanel` supplies the
gold hairline, the ornamental corners, the translucent near-black fill and the
small-caps serif title; `ResponsiveStage` arranges panels and handles the
narrow layouts. There is no per-page ornament and no second implementation for
mobile.

---

## The progression model

### One ledger, counted once

`XpTransaction` is the only source of truth for progress.

```
character lifetime XP = sum(amount) over every transaction
skill node XP         = sum(amount) over transactions with that node id
```

A transaction is counted once for the character and once for its node. Logging
a 30 XP guitar session gives Guitar 30 and the character 30 — never 60, and
never a bonus as it rolls upward. Branch and domain levels are *derived* from
node levels and award nothing extra.

The ledger is append-only. Nothing is edited or deleted; an undo appends a
compensating negative transaction with `reversesTxId` set, so history stays
readable.

### Baselines

Both the character and each skill node may carry a **baseline** representing
progress made before the ledger existed (`SkillNode.seedXp`, and one seed
transaction for the character). That is what lets the sample character open at
a realistic Level 12 with genuinely advanced skills. Everything after the
baseline moves through the ledger, single-counted. **Start empty** sets every
baseline to zero.

### Character levels

XP to advance from level *n* to *n + 1*:

| Levels   | Cost each |
| -------- | --------- |
| 1–5      | 300       |
| 6–10     | 600       |
| 11–30    | 1,000     |
| 31–100   | 2,000     |

Level 100 is the cap (162,500 lifetime XP). Ranks: Initiate (1–5), Apprentice
(6–10), Scholar (11–20), Adept (21–30), Vanguard (31–50), Master (51–75),
Grandmaster (76–99), Legend (100).

**Failing a quest never removes XP.** It can end a streak; it cannot reduce
lifetime XP or level. `failQuest` writes no transaction at all.

### Skill nodes

Nodes run 1–10, with 0 reserved for *Undiscovered* (no XP at all). Costs are
`100, 150, 200, 300, 400, 500, 600, 800, 1000`, so a node at level 7 needs 600
XP to reach 8.

Levels mean: 1 first exposure · 2 fundamentals · 3 guided practice ·
4 independent beginner · 5 consistently competent · 6 strong practical
experience · 7 advanced · 8 highly proficient · 9 expert · 10 exceptional
mastery.

Statuses derive from level: Undiscovered (0), Unlocked (1), Learning (2–4),
Proficient (5–6), Advanced (7–8), Mastered (9–10).

### Derived branch and domain levels

- **Branch level** = the highest level reached by **at least two** of its nodes
  (a single node branch falls back to that node). Depth has to be corroborated:
  one mastered node inside an otherwise shallow branch means you are strong at
  that one thing, not that the branch is mastered.
- **Domain level** = the rounded mean of its branch levels — breadth, not a
  single spike.

Both live in `src/domain/progression.ts` and are covered by tests.

### Quest XP

`Quest.characterXp` is the whole payout. Skill allocations are **carved out of**
it, never added on top; whatever is left over is banked as unallocated
character XP. A quest with 300 XP allocating 140/80/60 writes four transactions
totalling exactly 300.

Completion is guarded by `xpAwardedAt`. Re-opening and re-completing a quest
pays nothing further, and the confirmation dialog says so.

### Activity rules

Every repeatable rule is an editable `ActivityTemplate` with one of three
formulas:

- `rate` — `floor(amount / unitsPerXp) * xpPerBlock`. Partial blocks earn
  nothing: 95 calories at 1 XP per 10 calories is 9 XP, not 9.5.
- `fixed` — a flat award per finished piece.
- `range` — the user picks a value inside a band.

Seeded defaults cover reading (1 XP/page), calories (1 per 10), cycling
(1/minute), instrument practice (1/minute), ear training (1/minute), focused
coding (1 per 5 minutes), language and service time (1 per 5 minutes), coding
exercises (5–15) and business cases (10–25). All twenty are editable in-app
under *Activity rules* on the Skills page — `builtIn` changes the label, never
what you are allowed to do.

**Creative Arts is scored on output, never on time.** Finished drawing, poem
and creative-writing piece are 50 XP each; a selected final photograph is 5; a
simple interface design 10; a detailed one 15. All of them set
`requiresFinished`, so the log form demands an explicit confirmation and
unfinished work earns nothing however long it took.

### Abilities

Abilities hold **no XP and no level**. Status is derived every render:

| Status     | Condition                                            |
| ---------- | ---------------------------------------------------- |
| Locked     | no skill requirement met                             |
| Developing | some requirements met                                |
| Eligible   | every requirement met, proof outstanding             |
| Unlocked   | requirements **and** proof satisfied                 |
| Advanced / Mastered | manual promotion, only while genuinely unlocked |

Proof is satisfied by a completed linked proof quest **or** by attaching at
least `proofMinEvidence` pieces of evidence. Path tallies count only Unlocked,
Advanced and Mastered.

### Character attributes

The six attributes are entirely derived and cannot be levelled by hand. Each is
the same three-part blend:

```
60%  Skills          weighted domain levels
30%  Quest history   relevant completed quests
10%  Consistency     active days in the last 30
```

with per-attribute shaping (Discipline also reads deadlines respected;
Adaptability reads domain breadth and recovery after failed quests).

**These formulas are provisional and labelled as such in the UI.** They live in
`src/domain/attributes.ts`; the "how this is calculated" dialog on the Character
page reads the same breakdown the maths produces, so it cannot drift.

---

## Daily Quests

A collapsible **DAILY QUESTS** group sits at the top of the Quest Log. Collapsed
it is one row — the name, today's `2 / 4` count, the reset countdown and a
chevron. Expanded it stacks exactly four cards in a region that scrolls on its
own, so the quest list underneath stays reachable.

### The four slots

**Slot 1 is always the Daily Check**, and it is the only card with numerical
trackers:

| Tracker | Input | XP |
| ------- | ----- | -- |
| Reading | pages, whole numbers | 1 XP per page, to a chosen knowledge/language node |
| Calories | calories, whole numbers | `floor(calories / 10)` — 386 calories = 38 XP — to a Physical Development node |
| Instrument | instrument + minutes | 1 XP per minute, to `Music › Performance › <instrument>` |

Seeded targets are 20 pages, 400 calories and 20 minutes, all editable under
*Settings › Daily Check targets*. Progress reads `12 / 20 pages`. The
instrument picker offers Guitar, Piano, Zampoña, Kalimba, Violin, Ukulele, Pipa
and Harp, and new instruments become real skill nodes under Performance.

**Slots 2–4 rotate** through a pool of 19 binary quests — no trackers, a flat
`10 Character XP` each (editable per quest).

### Two rules that keep XP honest

1. **Submissions accumulate.** Saving 12 pages then 8 more leaves the day at 20,
   never at 8. Each submission writes exactly one immutable `daily-check`
   transaction carrying the activity, amount, calculated XP, skill node,
   timestamp and Daily Check id — and an entry is only ever written once.
2. **Corrections append, they never rewrite.** Editing an entry keeps the
   original row, marks it superseded, adds a revised row, and writes a
   `correction` transaction for the *difference*. Correcting 386 calories down
   to 100 writes `-28`; the original `+38` stays in the ledger.

**The Daily Check awards no Quest XP of its own.** The pages, calories and
minutes have already converted individually, so a completion bonus would pay for
the same work twice. Rotating quests are binary for the same reason: *Complete
the Planned Workout* pays its flat 10 XP and touches no skill node, so it can
never convert the calories the Daily Check already converted. A rotating quest
*can* be linked to a node, but it awards skill XP only when `awardsSkillXp` is
explicitly turned on.

### Reset and expiry

The day runs **11:59 PM to 11:59 PM in the browser's own timezone** — so
23:59:30 on the 4th already belongs to the 5th. The clock ticks while the app is
open, so a tab left running rolls over on its own.

**Expiry never removes anything.** Unfinished quests become `Expired`, a status
change and nothing more; no transaction is written, lifetime XP does not move
and the level cannot drop. The closed day is filed into `dailyHistory`, which
feeds the streak and the seven-day strip.

### Rotation

`selectRotatingQuests` in `src/domain/daily.ts` applies the rules in order:
drop inactive quests and any whose weekday schedule excludes today → place
pinned quests first (at most three) → step around quests completed yesterday
while alternatives exist → prefer quests tied to a domain that is actually
moving → spread the picks across categories → fill the rest at random.

The randomness is seeded from the date, so the function is pure: the same day
and settings always produce the same three quests. The roll is **also**
persisted as a `DailyQuestSelection`, which is what survives a refresh after a
manual swap. Completed quests cannot be replaced.

Categories: Academic, Technical, Business, Music, Physical, Personal Care,
Organization, Financial, Social.

### Models

`DailyQuestDefinition` (the reusable rule) is stored separately from
`DailyQuestInstance` (that quest on one date), so editing a definition never
rewrites yesterday's history. Alongside them: `DailyQuestSelection`,
`DailyCheck`, `DailyCheckEntry`, `DailyTarget` and `DailyQuestHistory`.

All of it persists — today's selection, pins, active flags, weekday schedules,
targets, partial Daily Check progress, completion state, transactions, history
and the streak.

---

## Data model

Every persisted record has a stable `id`, `createdAt` and `updatedAt`. All
models are in [`src/domain/types.ts`](src/domain/types.ts).

| Model | Notes |
| ----- | ----- |
| `CharacterProfile` | Display name, semester label, streaks |
| `XpTransaction` | The ledger. Append-only |
| `Quest` / `QuestObjective` / `QuestReward` | `xpAwardedAt` guards the payout |
| `SkillDomain` / `SkillBranch` / `SkillNode` | Nodes carry `parentIds`, which is what draws the tree |
| `ActivityTemplate` / `ActivityLog` | Templates are data, not code |
| `Ability` / `AbilityRequirement` / `AbilityEvidence` | Requirements target a node, branch or domain |
| `InventoryItem` / `InventoryLocation` | `sensitiveIdentifier` is masked by default |
| `FinancialSnapshot` | Cash and bank only |
| `DailyQuestDefinition` / `DailyQuestInstance` / `DailyQuestSelection` | Definitions are reusable rules; instances are one date's copy |
| `DailyCheck` / `DailyCheckEntry` / `DailyTarget` | Entries are immutable; corrections append |
| `DailyQuestHistory` | One closed-out day, written at the rollover |

Nothing is ever hard-deleted except by explicit user action: domains, branches,
nodes, quests and items all **archive**, and archiving never touches the ledger.

### Total Assets

```
Total Assets = Cash + Bank + estimated value of owned, non-archived items
```

The breakdown is printed under the figure on the Inventory page. It is
deliberately **not** called net worth, because liabilities are not modelled yet.

---

## Persistence, export and import

Everything the app knows about *where* state lives is in
[`src/store/persistence.ts`](src/store/persistence.ts). The store talks to a
`PersistenceAdapter` and nothing else.

- **Schema versioning.** `SCHEMA_VERSION` plus a `MIGRATIONS` map keyed by the
  version being migrated *from*. Exports carry the version, and importing a
  file from a newer schema is refused with an explanation rather than
  half-loaded.
- **Corrupted data.** Unreadable saved state is caught at the boundary and
  surfaced as a recovery dialog that offers the raw file for download *before*
  anything is discarded.
- **Storage unavailable.** Private browsing and full quotas are reported as a
  dismissible warning instead of a crash.
- **Export / import / reset** live on the Character page under *Export, import
  or reset*. Export writes one JSON file containing everything, ledger
  included.

### Replacing local persistence with Firebase

1. Implement `PersistenceAdapter` (`getItem` / `setItem` / `removeItem`)
   against Firestore. `getItem` may return a `Promise` — Zustand's `persist`
   middleware accepts an async adapter.
2. Return it from `createPersistenceAdapter()`.

No component and no domain function changes. If you want per-collection
documents rather than one blob, split `partialize` in `useAppStore.ts` and give
the adapter a key-to-collection map — still only those two files.

---

## Design system

Tokens live in two places that must be changed together: CSS custom properties
in `src/app/globals.css` and the Tailwind theme in `tailwind.config.ts`.

- **Surfaces** near-black `#05070B` and deep midnight blue
- **Text** warm ivory `#EFE6D6`, dimmed `#B6AB98`
- **Active state** desaturated teal `#5FD4CE` — used *only* for live/selected
  state and progress
- **Borders and titles** muted gold `#C8A45C`
- **Type** Cormorant Garamond for display, Inter for controls, each with a real
  system fallback so the layout holds if the webfont never arrives. One named
  scale in `tailwind.config.ts` drives everything — nothing in the app
  hard-codes a font size: metadata 17px, body 18–19px, quest names and buttons
  18–21px, accordion and panel headers 22px, large figures 34–40px
- **Motion** 150–250ms, and `prefers-reduced-motion: reduce` collapses every
  animation and transition

Two rings carry meaning consistently: **gold** is what you are inspecting,
**teal** is what is live.

See [Responsive behaviour](#responsive-behaviour).

---

## Responsive behaviour

One set of components, four arrangements. The panels, the state and the data
are identical at every width — only the geometry and the navigation change.

| Width          | Shell                    | Stage                                                      |
| -------------- | ------------------------ | ---------------------------------------------------------- |
| ≥ 1280px       | Desktop header           | Every panel side by side — the approved composition         |
| 1024–1279px    | Desktop header           | Up to three panels; a four-panel page (Skills) moves its first navigator into the breadcrumb |
| 768–1023px     | Desktop header           | Two panels: the one you picked from, and what you picked    |
| < 768px        | Top bar + bottom tab bar | One level at a time: `list → selection → details`           |

Breakpoints live in one file, `src/lib/useBreakpoint.ts`, and are measured with
`matchMedia`. There is no user-agent detection anywhere: a narrow desktop
window behaves exactly like a phone, which is also how it is tested.

### The mobile shell

A fixed top bar (semester, level, profile) and a fixed bottom tab bar
(Abilities, Skills, Inventory, Map, Quests). Both pad themselves out of the
device safe areas via `env(safe-area-inset-*)`, which is why the root layout
sets `viewportFit: 'cover'` — without it those insets report zero.

Content clears the fixed chrome with the `.mobile-scroll` padding rather than
by guessing at magic numbers; the chrome's own heights are CSS variables.

### One scroller, not many

The desktop composition fits a fixed viewport and scrolls inside each panel.
On a phone that produces nested scroll traps, so below 768px panels size to
their content (`[data-panel-body]` goes `overflow: visible`) and the **document**
scrolls.

Two related traps worth knowing about, both of which bit during this work:

- `html, body { height: 100% }` combined with `overflow-x: hidden` (which
  forces `overflow-y` to `auto`) quietly makes **body** the scroll container.
  `window.scrollY` then never moves and scroll restoration silently does
  nothing. The rule is `min-height: 100%`, with `overflow-x: hidden` on the
  root only.
- `overflow-wrap: anywhere` also collapses a box's min-content width, so short
  labels like "CASH" break one letter per line inside tight flex cells. The
  global rule is `break-word`; `.wrap-anywhere` opts in where a single long
  user-supplied token really can appear.

### Drill-down and back navigation

`ResponsiveStage` renders one pane at a time on mobile with a labelled back
button, and remembers each level's scroll position: drilling in starts at the
top, coming back returns you to the row you tapped.

### Per-page mobile shape

- **Quests** — compact Today strip → Daily Quests accordion → search →
  filter chips → full-width quest cards. Advanced filters open as a bottom
  sheet; the quest detail gets a sticky action bar with the secondary actions
  behind *More actions*; `+ New Quest` floats above the tab bar.
- **Skills** — the four columns become four levels. The skill tree turns
  vertical, one node per row, so a node's name and status never collide.
- **Abilities** — Paths → Catalogue (two-column grid, one column under 340px)
  → full-screen detail with a sticky *Start Proof Quest*.
- **Inventory** — Total Assets leads at display size, Cash and Bank follow in
  a snap rail, locations become a chip rail, items a two-column grid.
- **Character** — not a drill-down: one scrolling profile in the order level →
  attributes → radar → selected attribute → contributing progress.

### Touch and type

Every control is floored at 44 × 44px below 768px (`--tap-min`), including the
compact `sm` buttons used in dense desktop rows. Nothing depends on hover.
Dialogs become bottom sheets with a pinned action row, so Save survives the
software keyboard; they size against `dvh` where supported.

---

## Icons

Three supplied packages — 6 navigation marks, 7 domain emblems, 34 ability
emblems — plus a generic fallback.

### Masters and runtime copies

```
assets-master/icons/     1254x1254 originals. Preserved, never served,
                         never modified.
public/assets/icons/     Optimised copies the app loads.
```

`npm run icons` rebuilds the runtime tree from the masters
(`scripts/build-icons.mjs`). It is destructive only toward the generated tree,
never toward the masters. Navigation is emitted at 128px and domains/abilities
at 256px — comfortably past 3x DPR for their largest on-screen size — and the
script never upscales beyond the supplied original. PNG with alpha throughout;
never JPEG. The result is **2.2 MB of runtime assets from 37 MB of masters**.

### One registry

`src/lib/gameIcons.ts` is the only place a file path appears. Components ask
for a record id — `abilityIcon('abl_full-stack-builder')` — never for a path,
so artwork can be renamed or re-exported without touching a component. Desktop
and mobile navigation read the same `navigationIcons` object, and Skills →
Domains and Abilities → Paths read the same `domainIcons` object, so the seven
domain images are shared rather than duplicated.

`toIconSlug()` normalises an id, a slug or a display name into a lookup key. It
is a *lookup* helper only: a display name is never written back as an
identifier.

### Colouring by mask, not by filter

`GameIcon` paints a background colour and uses the PNG as a CSS `mask-image`.
The artwork's alpha channel carries its engraving detail — 14–27% of pixels are
midtones, not a flat silhouette — so masking preserves the shading while state
drives the hue. CSS filter stacks were rejected because they cannot land on an
exact colour.

Where `mask-image` is unsupported the component draws the original PNG instead.
That still reads correctly because the artwork is already antique gold, and
because colour is never the sole carrier of meaning here — every ability card
also prints `Unlocked`, `Eligible`, `Developing` or `Locked` in words.

Colours live in `globals.css` as `--icon-gold`, `--icon-cyan`,
`--icon-cyan-bright`, `--icon-developing` and `--icon-locked`.

| State | Colour | Opacity |
| ----- | ------ | ------- |
| Unlocked / Advanced / Mastered | cyan | 1 |
| Eligible | bright cyan | 1 |
| Developing | antique gold | 1 |
| Locked | muted grey | 0.5 |

A locked ability that is *selected* keeps its grey icon — selection is shown by
the card border, never by tinting a locked emblem as though it had opened.

### Sizes

| Where | Size |
| ----- | ---- |
| Desktop navigation | 24px |
| Mobile tab bar | 26px |
| Desktop domain sidebar rows | 28px |
| Mobile domain cards | 38px |
| Ability cards | 48px |
| Ability detail header | 72px |

Emblems sit directly above the ability name with no decorative ring: the
artwork is already ornamented, and the previous 44px circle cropped this level
of detail. Every icon reserves its box before loading, so nothing shifts.

### Missing mappings

An unknown id resolves to `fallback.svg` — a plain diamond-and-spark mark — and
logs the id once in development. It never throws, and it never silently borrows
a neighbouring record's artwork.

`tests/icons.test.ts` checks every path in the registry against the real
filesystem, so a renamed or missing export fails the suite rather than shipping
a broken image.

---

## Background artwork

The app ships with a hand-authored CSS atmosphere and needs no image files.
To use your own plates, drop them into `public/backgrounds/` and list them in
`public/backgrounds/manifest.json` — see the README in that folder for the slot
names. No rebuild is needed.

A manifest is used rather than a filename convention so that a default install
makes no request for artwork that is not there; a missing image would log a
console error on every page load.

The layer is `aria-hidden` and sits behind a dark overlay and a vignette, so
panel text keeps its contrast against any plate.

---

## Accessibility

- Full keyboard operation. Tabs use the WAI-ARIA roving-tabindex pattern;
  modals trap focus, close on Escape and restore focus on exit.
- Visible focus rings everywhere, never glow-only.
- Status is carried by wording *and* colour — `Eligible`, `Mastered`, `Overdue`
  are always written out, never encoded in a hue alone.
- Skill-tree nodes announce their graph position: *"Data Structures, level 5,
  Proficient, follows Python and C++ and JavaScript."*
- Every icon-only control has an accessible name and a tooltip.
- Destructive actions are confirmed, and archiving is offered alongside
  deletion wherever it is the better answer.
- Empty, loading, validation-error and corrupted-data states are all designed
  rather than left blank.

---

## Testing

```bash
npm test
```

176 tests over the domain, store and asset layers — the rules, not the pixels:

- `tests/progression.test.ts` — XP curves, rank bands, level boundaries, the
  level-100 cap, node levels, ledger roll-ups, and the branch/domain derivation
- `tests/activities.test.ts` — every seeded activity rule, including the fixed
  Creative Arts awards and the unfinished-work guard
- `tests/quests-abilities.test.ts` — XP splitting and the pay-once guard,
  ability gating across all five statuses, and assertions that the sample data
  reproduces the reference screens (Level 12 Scholar; the seven domain levels;
  Programming at Branch Level 7; the ability tallies 3/6, 4/6, 2/6, 3/6, 4/6,
  1/4; the inventory counts and totals)
- `tests/daily.test.ts` — the 11:59 PM reset boundary (including month and year
  rollovers), the three Daily Check formulas, correction chains, target
  progress, the rotation rules, and streaks
- `tests/daily-store.test.ts` — the Daily Quest actions end to end: the day roll
  is idempotent so a refresh cannot reroll it, quests pay once, replacing
  refuses completed quests, submissions accumulate, corrections append a delta,
  the Daily Check adds no bonus of its own, and expiry removes no XP
- `tests/migration.test.ts` — the v1 → v2 upgrade path, proving an existing save
  keeps its ledger, quests and levels
- `tests/icons.test.ts` — every registry path resolves to a file that is
  actually on disk, all 34 abilities map to their own distinct emblem, Skills
  and Abilities share one domain image, and unknown ids fall back rather than
  borrowing another record's artwork
- `tests/store.test.ts` — the actions end to end: quest completion pays once
  and pays again never, failing removes nothing, activity logging moves node
  and character by the same amount, reversal appends rather than deletes,
  proof quests link correctly, and export/import round-trips the whole state
  (rejecting junk and newer schemas without half-loading)

Because `src/domain` is pure, these run in plain Node with no DOM. The store
runs headless too: with no `window`, persistence falls back to its in-memory
adapter.

---

## Extending it

**Add an activity rule.** Use *Activity rules* on the Skills page (also
reachable from the log form via *Edit rules*) — you can create, edit and
archive rules there, seeded ones included. To change the shipped defaults
instead, append to `SPEC` in `src/domain/seed/activities.ts`. Either way
templates are data: the XP engine reads `formula` and needs no change.

**Add a skill domain, branch or node.** Either add to
`src/domain/seed/skills.ts` (authored by *level*; baseline XP is computed from
the curve, so retuning the curve never strands the sample data) or use the
in-app editors, which do the same thing at runtime.

**Add an ability.** Append to `SPEC` in `src/domain/seed/abilities.ts` with its
requirements and proof description. Gating is fully derived — there is no
status to maintain.

**Retune the XP curve.** `xpToAdvanceFrom` and `NODE_STEP` in
`src/domain/progression.ts`. Every readout follows.

**Change the attribute formulas.** `COMPONENT_WEIGHTS` and the three component
functions in `src/domain/attributes.ts`. The radar chart, the breakdown dialog
and the overall rating all follow automatically.

**Add a Daily Quest to the pool.** Append to `SPEC` in
`src/domain/seed/dailyQuests.ts`. New definitions are merged into existing saves
on load, so they appear without a reset. Keep them binary — trackers belong to
the Daily Check alone.

**Retune the daily reset.** `RESET_HOUR` and `RESET_MINUTE` in
`src/domain/daily.ts`. The countdown, the day key and expiry all follow.

**Change the rotation rules.** `selectRotatingQuests` in `src/domain/daily.ts`
is a pure function over definitions, history and date, so it can be reshaped
and tested without touching the store or a component.

**Resize the type scale.** `fontSize` in `tailwind.config.ts`, plus the handful
of element rules in `globals.css` (`body`, `.panel-title`, `.label-caps`,
`.field`, `.field-label`). Nothing else hard-codes a size. Restart the dev
server after editing the Tailwind config — it is read once at startup.

**Add a screen.** Create `src/app/<route>/page.tsx`, add it to `NAV_ITEMS` in
`TopNavigation.tsx`, and give it a background slot in `BackgroundLayer.tsx`.

---

## Deliberately not in version one

**`/map`.** The route exists and is styled, and it says *Coming later* in
plain terms. Placing quests and routines in space is a real feature that
deserves real design; a half-working map would be worse than an honest
placeholder. It is the only screen that is not functional, and nothing on it
pretends to be interactive.

Two smaller notes on the sample data, which is meant to be replaced:

- **Attribute values** differ from the numbers printed on the reference
  screens. Those were design placeholders; these come from the published
  formulas, and the quest-history component is only partly saturated on a fresh
  sample. The arithmetic is visible in the UI.
- **Total Assets** computes to $8,032 rather than the reference's $7,960. Cash,
  bank, all 27 items and every location count match the references exactly, but
  the reference total is not consistent with the $1,100 laptop it also shows.
  A correct, visible calculation was the higher priority.
