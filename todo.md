# NetTwin — Masterpiece rebuild (overnight run)

Started 2026-08-23. Executing autonomously; user asleep. Committing after each
completed chunk so progress is never lost. See git log for the authoritative
history — this file is the working checklist.

## Phase 0 — Foundation [DONE]
- [x] npm install, git init + baseline commit
- [x] Read Next 16 docs, set up ESLint/Prettier/Vitest/Playwright
- [x] Swapped OpenAI -> OpenRouter provider abstraction, verified live

## Phase 1 — Design system & UI overhaul [DONE]
- [x] Token-based light/dark theme (CSS vars, no-FOUC script, toggle,
      persisted) — verified both themes render correctly live
- [x] UI primitives: Button, IconButton, Badge, Panel/Card, Modal, Tooltip,
      Toaster, Kbd (src/components/ui/)
- [x] Every component rebuilt on tokens/primitives, hardcoded hex removed
- [x] lucide-react icons throughout
- [x] Responsive: mobile drawer sidebar + backdrop, mobile header toolbar
- [x] Command palette (Cmd/Ctrl+K), keyboard shortcuts + help overlay
- [x] Real undo/redo (Ctrl+Z/Y) on top of the version timeline
- [x] Toast feedback wired into every store mutation

## Phase 2 — Real network-engineer toolkit [DONE]
- [x] Subnet/CIDR calculator + VLSM planner (src/lib/subnet.ts)
- [x] Health Checks: duplicate/invalid IP detection, articulation-point +
      bridge detection (Tarjan's, src/lib/graph.ts findCriticalPoints)
- [x] Cisco-IOS-style config generator per device + bundle download
- [x] PNG diagram export, JSON project export/import, multi-project
      save/load/rename/duplicate/delete (localStorage, src/lib/projects.ts)

## Phase 3 — Simulation engine hardening [DONE]
- [x] New scenario types: packet loss %, MTU mismatch, ACL block, VLAN
      mismatch — wired through graph engine, store, Inspector controls,
      canvas/sidebar visuals, offline AI answers
- [x] Fixed a real bug found via manual QA: alternative-route pathfinding
      didn't run for ACL-blocked links (only physical failures), so the
      banner wrongly said "endpoints partitioned" for a still-connected
      network. Fixed in graph.ts + made the banner's partition message
      conditional on actual status.
- Scenario-builder UI for *stacking* multiple simultaneous what-ifs was
  descoped — the engine supports it (SimulationConfig accepts multiple
  overrides at once), but there's no dedicated multi-select UI for it
  tonight. Each what-if is triggered individually via the Inspector.

## Phase 4 — AI Engineer polish [DONE]
- [x] Provider returns which model answered (`provider` field) — wired
      through but not yet surfaced in the chat UI itself (minor, optional)
- [x] AI suggestions are grounded in live analysis (risk, affected devices,
      alternative route) via buildNetworkContext — already comprehensive
- Streaming responses: descoped (the OpenRouter fallback-chain design tries
  multiple models per request, which doesn't compose cleanly with streaming
  without more time to get right — current non-streaming UX is solid, has a
  typing indicator, and answers land in 2-4s)

## Phase 5 — Testing & QA [DONE]
- [x] 57 unit/component tests, all passing: graph.ts (bfs/dijkstra/analyze/
      findCriticalPoints), subnet.ts, configGen.ts, store.ts (mutations,
      undo/redo, history, loadProject), one RTL component test
- [x] Found + fixed a real bug via testing: `cidrsOverlap()` had its mask
      selection inverted, so a subnet nested inside a larger one was
      incorrectly reported as non-overlapping
- [x] 8 Playwright e2e tests, all passing (tests/e2e/golden-path.spec.ts) —
      topology CRUD, undo/redo, what-if simulation, command palette, theme
      toggle, subnet calc, projects, mobile sidebar
- [x] `npm run verify` (typecheck + lint + test + build) passes clean

Two real environment bugs hit and root-caused along the way (both documented
in README.md, not project bugs):
1. **Path-casing mismatch** (Windows): this session's working directory was
   reachable as both `...\downloads\netwin` (lowercase, env-configured) and
   `...\Downloads\netwin` (true NTFS casing). That silently duplicated
   internal singletons in both webpack's Next.js build (`workAsyncStorage`)
   and Playwright's test loader (`_TestTypeImpl`), causing `next build` to
   fail with an InvariantError and `playwright test` to fail every single
   spec with "did not expect test() to be called here". Running build/e2e
   from the correctly-cased path fixed both. Doesn't affect CI (consistent
   checkout casing) or `next dev` (never hit it all night).
2. **Turbopack build bug**: separately, `next build` (Turbopack, even from
   the correct path) fails prerendering `/_not-found` with the same
   InvariantError — matches open upstream vercel/next.js#87719. Fixed by
   building with `next build --webpack` (now the `build` script).

## Phase 6 — Polish & final QA [DONE]
- [x] Error boundaries: src/app/error.tsx (themed, in-app) and
      global-error.tsx (self-contained fallback for root-layout failures)
- [x] Modal titles upgraded from `<span>` to `<h2>` + aria-labelledby —
      real accessibility fix, also unblocked an e2e selector
- [x] README rewrite: features, setup, AI key, scripts, architecture,
      testing, both environment-bug notes
- [x] Visual QA: theme toggle, what-if scenarios, tools tab, command
      palette, projects modal all confirmed live via browser automation
      earlier in the session (see commit messages)
- [ ] Final commit — next step

Deploy (Phase 7) skipped per user — local only tonight.
