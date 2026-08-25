# NetTwin

A network digital twin: model a real topology, simulate failures and
degradation with real graph algorithms, plan subnets and generate device
configs, and ask an AI network engineer to explain the impact — all inside a
safe, offline-first simulation. No real device is ever touched.

## Features

**Topology editor** — add routers/hosts, drag to connect, reposition, delete.
Undo/redo (Ctrl+Z / Ctrl+Shift+Z), full version history with diff view
between any two points in time.

**What-if simulation** — fail a link or a device, raise latency, throttle
bandwidth, inject packet loss, simulate an MTU mismatch, block a link by ACL
policy, or put a device on the wrong VLAN. The engine (Dijkstra + BFS over a
live adjacency graph) recomputes reachability, the lowest-latency alternative
route, and a risk level (low/medium/high/critical) after every change.

**Network-engineer toolkit** (Tools tab):
- Subnet/CIDR calculator and a VLSM planner
- Health Checks: duplicate/invalid IP detection, plus articulation-point and
  bridge detection (Tarjan's algorithm) — flags real single points of
  failure and critical links in your design
- Cisco-IOS-style config generator, per device or bundled
- PNG diagram export

**Projects** — save/load/rename/duplicate topologies in the browser, or
export/import a portable JSON file to move between machines.

**AI Engineer** — ask it about the live topology and any active what-if. Runs
on OpenRouter (a small fallback chain of free models) when a key is present;
falls back to a topology-aware rule-based answer engine when it isn't — the
app is always useful with zero configuration.

**Command palette** (Cmd/Ctrl+K), full keyboard shortcuts (`?` for the list),
light/dark theme, responsive layout down to phone width.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### AI Engineer (optional)

Without any setup, the AI Engineer panel works using a rule-based offline
answer engine grounded in the live topology. To get LLM-generated answers
instead, create `.env.local`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Get a free key at [openrouter.ai](https://openrouter.ai/settings/keys). The
provider (`src/lib/ai/openrouter.ts`) tries a short chain of free models in
order and falls back to the offline engine if all of them fail or no key is
set — nothing ever breaks for lack of a key.

## Scripts

| Command              | Does                                          |
| --------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)              |
| `npm run build`        | Production build                              |
| `npm run start`        | Run the production build                      |
| `npm run typecheck`    | `tsc --noEmit`                                |
| `npm run lint`         | ESLint                                        |
| `npm run test`         | Vitest (unit + component tests)               |
| `npm run test:e2e`     | Playwright e2e (8 tests)                      |
| `npm run verify`       | typecheck + lint + test + build, in order     |

## Architecture

- **`src/lib/graph.ts`** — the simulation engine: adjacency construction
  (honors every what-if override), BFS/Dijkstra, partition/risk detection,
  and structural analysis (articulation points, bridges). Pure functions,
  fully unit tested.
- **`src/lib/store.ts`** — Zustand store: topology CRUD, what-if dispatch,
  undo/redo, version history, chat. All mutation logic lives here; components
  are thin.
- **`src/lib/subnet.ts` / `configGen.ts` / `projects.ts`** — the toolkit's
  pure logic, independent of the graph engine, also fully unit tested.
- **`src/lib/ai/`** — provider abstraction (`openrouter.ts`), the offline
  rule-based fallback (`offline.ts`), and the orchestrator (`index.ts`) the
  API route calls into.
- **`src/components/ui/`** — small design-system primitives (Button, Modal,
  Toast, Badge, Tooltip, Kbd) built on CSS custom-property tokens defined in
  `src/app/globals.css`, so the whole app re-themes by flipping one
  `data-theme` attribute.

## Known local-environment issue: path casing on Windows

If you're on Windows and `npm run build` or `npm run test:e2e` fails with
`Invariant: Expected workStore to be initialized` (Next.js) or `Playwright
Test did not expect test() to be called here` (Playwright) — check that
you're running the command from your project folder's **true on-disk
casing**. Both failures traced back to the same root cause here: this
project's working directory was reachable as both
`C:\Users\NB\downloads\netwin` (lowercase, matching an env-configured path)
and `C:\Users\NB\Downloads\netwin` (the real NTFS casing — Windows always
capitalizes the `Downloads` special folder). Webpack and Playwright's test
loader both resolve internal modules by path string, so the two casings
were treated as two different copies of the same file, silently duplicating
singletons that are supposed to be shared for the whole process (Next's
internal `workAsyncStorage`, Playwright's `_TestTypeImpl`). Running from the
correctly-cased path fixed both immediately, no code changes needed beyond
switching the `build` script to `next build --webpack` (see below).
CI runners check out fresh with one consistent casing, so this never shows
up there — it's a local dev-machine quirk, not a project bug.

## Known environment issue: Turbopack build

Separately from the casing issue above, `npm run build` uses `next build
--webpack` rather than the Turbopack default even from the correct path.
Building with Turbopack fails while prerendering `/_not-found` with
`Error [InvariantError]: Invariant: Expected workStore to be initialized.
This is a bug in Next.js.`, matching an open upstream issue
(vercel/next.js#87719). `next dev` (Turbopack) is unaffected — only the
static-export phase of `next build` hits this. Worth retrying without
`--webpack` after a Next.js update to see if it's fixed upstream.

## Testing

57 unit/component tests (Vitest + React Testing Library) cover the graph
engine, subnet math, config generator, and store mutations/undo-redo —
including two real bugs the tests caught before they shipped (an inverted
mask comparison in `cidrsOverlap`, and a missing reroute computation for
ACL-blocked links). Run with `npm run test`.

8 Playwright e2e tests (`tests/e2e/golden-path.spec.ts`) cover topology
editing, undo/redo, what-if simulation, the command palette, theme toggle,
the subnet calculator, project save, and the mobile sidebar. Run with
`npm run test:e2e` (builds and serves the app itself via
`playwright.config.ts`'s `webServer`). On Windows, see the path-casing note
above if this fails — it isn't a bug in the tests.

## Notes

This is a simulation twin. Nothing in this app ever connects to, configures,
or affects a real network device — every "failure," "fix," and generated
config is a model, clearly labeled as such throughout the UI and in the AI's
own responses.
