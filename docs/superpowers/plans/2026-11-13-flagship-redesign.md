# ApexArena Flagship Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "The Canyon" redesign: a cinematic landing page at `/`, a loading gate at `/enter`, and the existing app moved to `/app/*`, re-skinned in the same language with a Simple / Pro density switch.

**Architecture:** The approved prototype's three.js scene is ported to a typed, framework-free `CanyonScene` class mounted by one client component; GSAP ScrollTrigger writes chapter progress into a zustand store the scene reads each frame. Everything in the DOM is React + Tailwind v4 + shadcn/ui. The app keeps `ArenaProvider` / `useArena()` and the simulation worker unchanged, hoisted into an `/app` layout so it survives navigation.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn/ui (Radix), three ^0.169.0, gsap ^3.12.5 + @gsap/react + ScrollTrigger, zustand ^5, lightweight-charts ^5 (existing), next/font (Archivo, Martian Mono), Vitest, @playwright/test. Package manager: bun.

**Spec:** `docs/superpowers/specs/2026-11-13-flagship-redesign-design.md`. Visual source of truth: `docs/design/landing/DESIGN_GUIDE.md` and the prototype `docs/design/landing/index.html`, `gate.html` (port from these; when this plan and the guide disagree on a visual value, the guide wins).

## Global Constraints

- All shell commands run with `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"`; web commands run in `apps/web-arena`.
- Never edit the Rust crates, the Python SDK, or the worker's simulation logic in `src/workers/arena.worker.ts`. Rust determinism invariants (CLAUDE.md §3) stay untouched; `./scripts/verify_determinism_hook.sh` and the Python suite must pass at the end.
- The user's uncommitted GitHub Pages work (`NEXT_PUBLIC_STATIC_DEMO`, `build:pages`, `.github/workflows/pages.yml`, demo banner) is never reverted or overwritten. If it is still uncommitted when Task 1 starts, stop and ask the user to commit it. `build:pages` is allowed to break.
- COEP `require-corp` stays on: no CDN scripts, fonts or images. three, gsap and fonts come from npm / `next/font`.
- Tokens, exactly (guide §2): ink `#050608`, ink-2 `#0A0C10`, haze `#141A24`, haze-hot `#29110A`, bone `#EDEAE3`, bone-2 `#A8A69F`, bone-3 `#8C8A84`, rule `rgba(237,234,227,.13)`, rule-2 `rgba(237,234,227,.28)`, bid `#45E0BC`, ask `#FF5A45`, pool `#6C9CFF`, shock `#FFB020`, scene grey `#7C8794`. Data colours never on chrome. No purple. `--radius: 2px`. No cards, shadows or blur on the landing page.
- Type: Archivo (variable incl. `wdth`) for words, Martian Mono (variable incl. `wdth`) for numbers / hashes / identifiers / status line. Sentence case, no all-caps labels. Minimum text 12px everywhere (including mobile hash rows).
- Copy is taken verbatim from guide §6 (including Plain and Precise variants). LinkedIn URL stays a visible placeholder `TODO: LinkedIn URL` until the user supplies it.
- Engine figures on the page come only from `src/lib/canyon/real.json` (Task 3); the live scene is labelled "simulated in your browser". The browser worker's digest is FNV-1a, never called SHA-256.
- Charts keep strictly ascending, de-duplicated timestamps (CLAUDE.md §3.2).
- Reduced motion (`prefers-reduced-motion` or `?rm`) and no-WebGL2 must render a designed, fully readable page.
- Commit at the end of every task on branch `feat/flagship-ui`; never push.

## Review Focus

1. **Navigating between `/app` pages must not restart the market.** Tick must keep increasing from `/app` to `/app/agents` and back. Pinned in Task 2's e2e test `app pages share one running simulation`.
2. **The Plain / Precise and Simple / Pro switches must persist** across reloads (`localStorage` keys `apex-depth` and `apex-density`) without resetting scroll or the scene. Pinned in Task 6 (`depth toggle persists`) and Task 9 (`density toggle persists`).
3. **Orders larger than the ladder** (slider max 45 ETH vs ~47.5 ETH of depth, plus any future ladder change) must report levels cleared ≤ 7 and an average over the filled quantity only, never NaN. Pinned in Task 4 `walkAsks clamps to available depth`.
4. **Rotating or resizing mid-scroll** must switch between the landscape and portrait camera tables, keep the canvas unstretched and keep labels inside the viewport. Pinned in Task 5 `chapterState switches table on aspect` plus a manual check in Task 11.
5. **No external requests under COEP:** a missing font or a CDN URL silently breaks styling in production. Pinned in Task 2's e2e `no cross-origin requests` (fails on any request whose origin is not localhost).

---

### Task 1: Foundation: Tailwind v4, shadcn/ui, fonts, test tooling

**Files:**
- Create: `apps/web-arena/postcss.config.mjs`, `apps/web-arena/components.json`, `apps/web-arena/src/lib/utils.ts`, `apps/web-arena/src/styles/tokens.css`, `apps/web-arena/src/styles/legacy.css`, `apps/web-arena/vitest.config.ts`, `apps/web-arena/playwright.config.ts`, `apps/web-arena/src/lib/fonts.ts`
- Modify: `apps/web-arena/package.json`, `apps/web-arena/tsconfig.json` (add `"@/*": ["./src/*"]` if absent), `apps/web-arena/src/app/globals.css`, `apps/web-arena/src/app/layout.tsx`, `.gitignore` (add `apps/web-arena/test-results/`, `apps/web-arena/playwright-report/`)
- Test: `apps/web-arena/src/lib/utils.test.ts`

**Interfaces:**
- Produces: Tailwind theme colours `ink, ink-2, haze, haze-hot, bone, bone-2, bone-3, rule, rule-2, bid, ask, pool, shock`; font CSS variables `--font-archivo`, `--font-martian`; Tailwind font utilities `font-sans` (Archivo) and `font-mono` (Martian Mono); `cn(...classes: ClassValue[]): string` in `src/lib/utils.ts`; shadcn components under `src/components/ui/shadcn/`; scripts `test` (vitest run), `test:e2e` (playwright test).

- [ ] **Step 1:** Confirm the user's Pages changes are committed (`git status --short apps/web-arena/next.config.ts .github` prints nothing). If not, stop and ask the user.
- [ ] **Step 2:** Install: `bun add tailwindcss@^4 @tailwindcss/postcss three@^0.169.0 gsap@^3.12.5 @gsap/react zustand@^5 clsx tailwind-merge class-variance-authority lucide-react` and `bun add -d vitest @types/three @playwright/test`, then `bunx playwright install chromium`.
- [ ] **Step 3:** Write the failing test `cn merges and dedupes tailwind classes`: `expect(cn('px-2', 'px-4', false && 'x')).toBe('px-4')`.
- [ ] **Step 4:** Run `bun run test` and confirm it fails (`cn` not found / script missing).
- [ ] **Step 5:** Add `cn` (clsx + tailwind-merge) and the `test` / `test:e2e` scripts; vitest `environment: 'node'`, `include: ['src/**/*.test.ts']`.
- [ ] **Step 6:** Move the current `src/app/globals.css` verbatim to `src/styles/legacy.css`. Write the new `src/app/globals.css`: `@import "tailwindcss";`, `@import "../styles/tokens.css";`, an `@theme` block with the Global Constraints colours and `--radius: 2px`, the guide's shadcn variable mapping (`--background: ink`, `--foreground: bone`, `--primary: bone`, `--primary-foreground: ink`, `--muted-foreground: bone-2`, `--border: rule-2`, `--ring: bone`, `--destructive: ask`), body `bg-ink text-bone font-sans`, focus ring 2px bone with 3px offset, `::selection` in bone at 20%.
- [ ] **Step 7:** `src/lib/fonts.ts`: `next/font/google` `Archivo({ subsets:['latin'], axes:['wdth'], variable:'--font-archivo' })` and `Martian_Mono({ subsets:['latin'], axes:['wdth'], variable:'--font-martian' })`. Use them in `layout.tsx`, replacing Inter / JetBrains Mono.
- [ ] **Step 8:** `bunx shadcn@latest init` (style new-york, base colour neutral, CSS variables on, `src/components/ui/shadcn` alias), then `bunx shadcn@latest add button toggle-group tabs table tooltip dialog command slider switch sheet`. Override every component's radius to `rounded-[2px]` via the theme variable, not per file.
- [ ] **Step 9:** Run `bun run test` → PASS; `bun run typecheck` → no errors; `NEXT_DIST_DIR=.next-build bun run build` → success. The old app may look unstyled at this point; Task 2 restores it.
- [ ] **Step 10:** Commit `chore(web): add Tailwind v4, shadcn/ui, Archivo + Martian Mono, Vitest and Playwright`.

### Task 2: Routes: `/`, `/enter`, `/app/*` with one shared simulation

**Files:**
- Create: `src/app/app/layout.tsx`, `src/app/app/page.tsx` (Arena), `src/app/app/agents/page.tsx`, `src/app/app/benchmark/page.tsx`, `src/app/app/proof/page.tsx`, `src/app/enter/page.tsx` (placeholder: "Continue as guest" link to `/app`), `e2e/routes.spec.ts`
- Modify: `src/app/page.tsx` (placeholder landing with an "Enter the arena" link to `/enter`), `src/lib/arena.tsx` (`ViewId` and `VIEWS` become route-based; drop `overview`), `src/components/shell/AppShell.tsx`, `src/components/shell/CommandPalette.tsx`
- Delete: `src/components/views/OverviewView.tsx`, `src/components/overview/`

**Interfaces:**
- Consumes: `ArenaProvider`, `useArena()` (unchanged contract except `view` / `setView`).
- Produces: `APP_ROUTES: { id: 'arena'|'agents'|'benchmark'|'proof'; href: string; label: string; key: '1'|'2'|'3'|'4' }[]` exported from `src/lib/routes.ts`; `useArena().view` derived from `usePathname()`; `setView(id)` calls `router.push(href)`. `/app/proof` renders the existing `ArchitectureView` for now.

- [ ] **Step 1:** Write the Playwright tests in `e2e/routes.spec.ts`: `every route renders` (`/`, `/enter`, `/app`, `/app/agents`, `/app/benchmark`, `/app/proof` all return 200 and log no console errors); `app pages share one running simulation` (read the tick from the status bar on `/app`, click the Agents nav link, wait 1 s, go back, and assert the tick increased and never reset below the first reading); `no cross-origin requests` (collect `page.on('request')` across all routes and assert every URL starts with `http://localhost:3000`).
- [ ] **Step 2:** Run `bun run test:e2e` with the dev server and confirm it fails (routes 404).
- [ ] **Step 3:** Create the route tree. `src/app/app/layout.tsx` (client) wraps children in `ArenaProvider` + the current `AppShell` and imports `@/styles/legacy.css`, so the old look survives until Task 9. Each page renders its existing view (`ArenaView`, `AgentLabView`, `BenchmarkView`, `ArchitectureView`). Keys 1–4 and ⌘K navigate via `router.push`.
- [ ] **Step 4:** Run `bun run test:e2e` → PASS. Run `bun run typecheck` → clean.
- [ ] **Step 5:** Commit `feat(web): move app to /app/* with a shared simulation layout; add /enter`.

### Task 3: Real engine data at build time

**Files:**
- Create: `scripts/gen-real-data.ts`, `src/lib/canyon/real.ts`, `src/lib/canyon/real.json` (generated, committed), `src/lib/canyon/__fixtures__/snapshot.json` and `verify.json` (captured once from the binary), `src/lib/canyon/real.test.ts`
- Modify: `package.json` (`"gen:real": "bun scripts/gen-real-data.ts"`, `"prebuild": "bun run gen:real"`)

**Interfaces:**
- Produces: `type RealData = { seed: 42; ticks: 300; scenario: 'flash-crash'; hash: string; hashesEqual: boolean; mid: number; asks: [price: number, size: number][]; lambdaCalm: number; leaderboard: { agentId: string; role: string; pnlBps: number; maxDrawdownBps: number; psr: number; calmar: number; survival: number; acs: number; liquidated: boolean }[] }`; `parseTui(snapshot: unknown, verify: unknown): RealData`; `export const REAL: RealData` (imports `real.json`).

- [ ] **Step 1:** Capture the fixtures: `target/debug/apex-tui --scenario flash-crash --seed 42 --ticks 300 --json > …/snapshot.json` and `target/debug/apex-tui --verify-determinism --seed 42 --ticks 300 > …/verify.json`.
- [ ] **Step 2:** Write failing tests in `real.test.ts`: `parseTui reads the ledger values` asserts `hash === '4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614'`, `hashesEqual === true`, `mid ≈ 2142.31` (to 2 dp), `asks.length === 7` with `asks[0] ≈ [2142.69, 1.858]`, the leaderboard ACS values `[0.883, 0.881, 0.234, 0.000]` (3 dp) in that agent order (Gemini-2.5, DeepSeek-R1, Hawkes-HFT, MM-Alpha) with MM-Alpha `liquidated === true`; and `parseTui rejects malformed input` (throws on `{}`).
- [ ] **Step 3:** Run `bun run test real` and confirm it fails.
- [ ] **Step 4:** Implement `parseTui` (pips ÷ 10⁸ for prices and sizes; calm λ = `hawkes_intensity_pips / 1e8` from a calm run, or 0.20 when the calm run is unavailable) and the script. When the binary is missing, the script prints `gen:real: apex-tui not found, keeping existing real.json` and exits 0; when the output differs from the committed file, it rewrites it and prints `gen:real: updated real.json`.
- [ ] **Step 5:** Run `bun run test real` → PASS; `bun run gen:real` → writes or keeps `real.json`.
- [ ] **Step 6:** Commit `feat(web): generate real engine data for the landing page`.

### Task 4: Canyon model, ladder and chapter table (pure TypeScript)

**Files:**
- Create: `src/lib/canyon/model.ts`, `src/lib/canyon/ladder.ts`, `src/lib/canyon/chapters.ts`, `src/lib/canyon/model.test.ts`, `src/lib/canyon/ladder.test.ts`, `src/lib/canyon/chapters.test.ts`

**Interfaces:**
- Produces:
  - `model.ts`: constants `SPAN=24, LEN=64, W=7, NL=14, NEV=8`; `type MarketEvent = { t: number; mag: number; dir: -1|1 }`; `midBase(t: number): number`; `market(tau: number, events: readonly MarketEvent[]): { cx: number; hs: number; sh: number }`; `lvl(l: number, tau: number, side: -1|1): number`; `lambda(tau: number, events: readonly MarketEvent[]): number` (`0.20 + Σ mag·2.3·e^(−0.55·dt)` over dt > 0). Formulas exactly as guide §3 "World" and prototype lines 519–528.
  - `ladder.ts`: `walkAsks(qty: number, asks: readonly [number, number][], mid: number): { filled: number; avgFill: number; impactBps: number; levelsCleared: number }`, mirroring the prototype's `impact()` (impact uses the last touched price).
  - `chapters.ts`: `type ChapterState = { pos: [number,number,number]; tgt: [number,number,number]; fov: number; focus: number; ap: number; split: number; dim: number; hist: number; face: number; agents: number; follow?: number; score: number; pool: number; orders: number }`; `CHAPTERS: ChapterState[]` (10 entries, prototype `ST`), `PORTRAIT: number[][]` (prototype `m`); `chapterTable(aspect: number): ChapterState[]` (portrait when `aspect < 0.8`); `blendChapter(a: ChapterState, b: ChapterState, t: number): ChapterState` with `t` passed through `smoothstep(0.08, 0.92)`.

- [ ] **Step 1:** Write the failing tests:
  - `market is calm with no events`: `market(30, []).hs === 0.16`, `.sh === 0`.
  - `a shock widens the spread`: with `[{t:30,mag:1,dir:-1}]`, `market(31, ev).hs > 0.16` and `.cx < midBase(31)`.
  - `lambda is 0.20 when calm`: `lambda(30, []) === 0.2`.
  - `walkAsks matches the prototype at 12 ETH`: with `REAL.asks` and `REAL.mid`, `levelsCleared === 3`, `avgFill` ≈ 2144.32 (2 dp), `impactBps` ≈ 17.3 (1 dp).
  - `walkAsks clamps to available depth`: `walkAsks(1000, asks, mid)` gives `levelsCleared === 7`, `filled` ≈ the ladder total, a finite `avgFill`, and `impactBps` computed from the 7th level.
  - `walkAsks of zero`: `walkAsks(0, …)` gives `filled 0`, `levelsCleared 0`, `impactBps 0`, `avgFill === asks[0][0]`.
  - `blendChapter endpoints`: `t=0` returns `a`'s values, `t=1` returns `b`'s.
  - `chapterState switches table on aspect`: `chapterTable(0.6)[0].pos` deep-equals `[0,7,32]` and `chapterTable(1.6)[0].pos` deep-equals `[-1.2,5.2,17.5]`.
- [ ] **Step 2:** Run `bun run test canyon` and confirm it fails.
- [ ] **Step 3:** Implement the three modules.
- [ ] **Step 4:** Run `bun run test canyon` → PASS.
- [ ] **Step 5:** Commit `feat(web): canyon market model, order ladder and chapter camera table`.

### Task 5: CanyonScene engine and canvas component

**Files:**
- Create: `src/lib/canyon/shaders.ts`, `src/lib/canyon/scene.ts`, `src/lib/canyon/store.ts`, `src/components/landing/CanyonCanvas.tsx`, `src/components/landing/SceneLabels.tsx`, `e2e/landing-scene.spec.ts`
- Modify: `src/app/page.tsx` (mount `CanyonCanvas` full-bleed behind the placeholder)

**Interfaces:**
- Consumes: Task 4 modules, `REAL` (Task 3).
- Produces:
  - `store.ts` (zustand, no React state per frame): `useCanyon` with `{ chapter: number; blend: number; progress: number[]; depth: 'plain'|'precise'; mood: 'calm'|'toxic'|'whale'|'crash'; reducedMotion: boolean; fire(mag: number, dir: -1|1): void; setChapter(i: number, blend: number): void; setProgress(i: number, p: number): void; setDepth(d): void; sendOrder(qty: number): void }`, plus a non-React `canyonState` getter the scene reads each frame.
  - `scene.ts`: `class CanyonScene { constructor(canvas: HTMLCanvasElement, opts: { mobile: boolean; reducedMotion: boolean; mode: 'landing'|'gate' }); start(): void; stop(): void; resize(w: number, h: number): void; setPointer(x: number, y: number): void; project(v: [number,number,number]): { x: number; y: number; visible: boolean }; readonly status: { tick: number; mid: number; spreadBps: number; lambda: number; regime: string }; dispose(): void }`. Also `static supported(): boolean` (WebGL2).
  - `CanyonCanvas`: `<CanyonCanvas mode="landing"|"gate" />` (fixed, `aria-hidden`, vignette + film grain overlays per guide §3).
- [ ] **Step 1:** Write the failing Playwright test `landing-scene.spec.ts`:
  - `canvas renders without errors`: on `/`, one `canvas` exists, the console logs no errors, and after 3 s the canvas pixel at the viewport centre is not pure `#050608`, read via `page.screenshot` + sharp.
  - `reduced motion still renders`: same, with `?rm`.
  - `no WebGL2 shows the poster`: inject `HTMLCanvasElement.prototype.getContext = () => null` before load and assert `html.no-gl` and the poster element.
- [ ] **Step 2:** Run the spec and confirm it fails.
- [ ] **Step 3:** Port the prototype's scene into `shaders.ts` (GLSL strings: `GLSL_MARKET`, point / line fragment shaders, DOF, background, terrain, slice, thread, floor, agents, orders, pool, edges, stems, slug) and `scene.ts`. Rules:
  - Keep every value from guide §3 and the prototype.
  - Hoist per-frame allocations.
  - DPR is capped at 1.75 desktop / 1.5 mobile and drops to 1.25 after a 2 s average frame time over 22 ms.
  - Pause on `document.hidden`.
  - The opening crash fires 4.2 s after start only in `landing` mode, only if idle and still in chapter 0.
  - The thinking-agent pulse fires on every whole simulated second.
- [ ] **Step 4:** Implement `CanyonCanvas` (dynamic import, `ssr:false`) and `SceneLabels` (DOM labels positioned each frame from `scene.project`; 12px Martian Mono with a 16px leader; hidden under 860px except agent names; agent label copy from guide §6, Plain and Precise).
- [ ] **Step 5:** Run the spec → PASS. Capture `/` at 1440×900 and compare it by eye with `docs/design/landing/screens/hero.png`: canyon framing, agent positions, horizon light and grain must match. Fix any visible drift before committing.
- [ ] **Step 6:** Commit `feat(web): port the Canyon WebGL scene`.

### Task 6: Landing chrome and static chapters

**Files:**
- Create: `src/content/landing.ts`, `src/components/landing/{TopBar,ChapterRail,StatusLine,Stage,Readout,Credit,Close,StackRows,Footer}.tsx`, `src/components/landing/useDepth.ts`, `e2e/landing.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useCanyon` (`depth`, `setDepth`, `setChapter`, `setProgress`), `CanyonScene.status` (status line), `REAL`.
- Produces: `landing.ts` exports `COPY` typed per chapter: `{ id: 'c0'…'c9'; rail: string; title: string; lede: string; precise: string; … }` with every string from guide §6 verbatim; `<Stage variant="l"|"r"|"b"|"c"|"f" heightVh={number}>` (sticky 100svh, 12-col grid, local scrim); `useDepth(): ['plain'|'precise', (d) => void]`, persisted to `localStorage['apex-depth']` and mirrored to `document.documentElement.dataset.depth`.

- [ ] **Step 1:** Write the failing e2e tests in `landing.spec.ts`:
  - `hero shows the approved copy`: h1 text `A market that fights back.`; buttons `Enter the arena` and `Crash the market`.
  - `depth toggle persists`: click Precise, the Precise line under the hero becomes visible, reload, it is still visible and `localStorage['apex-depth'] === 'precise'`.
  - `enter the arena goes to the gate`: the hero button navigates to `/enter`.
  - `credit links`: a GitHub link to `https://github.com/priyanshu-mishra` and a LinkedIn placeholder whose visible text contains `TODO: LinkedIn URL`.
  - `no text under 12px`: evaluate every text node's computed font-size and assert all are ≥ 12.
- [ ] **Step 2:** Run it and confirm it fails.
- [ ] **Step 3:** Build the chrome and chapters 00 (hero), 07 (stack), 08 (credit), 09 (close) and the footer:
  - Structure: `main > section#c0…#c9` with the chapter heights from guide §4.
  - Scroll wiring: ScrollTrigger writes `setChapter` / `setProgress` (no React state per frame).
  - Reveals: titles use the `.ln` mask reveal (`expo.out`, 1.1 s, 80–90 ms stagger); ledes fade up (0.9 s, `power3.out`).
  - Status line: `role="status"`, `aria-live="off"`, fed by `scene.status` at 4 Hz.
  - Chapter rail at ≥1100px.
  - Reduced motion: no reveals.
- [ ] **Step 4:** Run the e2e tests → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(web): landing chrome, hero, stack, credit and close`.

### Task 7: Interactive chapters 01–06

**Files:**
- Create: `src/components/landing/{OrderControl,VenueReadouts,MoodSelector,LambdaTrace,TickStrip,Leaderboard,WeightBar,HashRows}.tsx`, `e2e/landing-interactions.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `walkAsks` (Task 4), `REAL`, `useCanyon` (`sendOrder`, `fire`, `mood`, `progress`), `CanyonScene.status`.
- Produces: none for later tasks except `Leaderboard`, `WeightBar` and `HashRows`, which Task 10 reuses with props `Leaderboard({ rows: RealData['leaderboard']; precise: boolean })`, `WeightBar()`, `HashRows({ hashes: string[]; lit: number; verdictHref?: string })`.

- [ ] **Step 1:** Write the failing e2e tests:
  - `order slider walks the real ladder`: set the range to 12, and the readouts show `+17.3`, `3 of 7 price levels cleared` and `2,144.32`.
  - `mood triggers update the status line`: click Flash crash and the status line regime becomes `flash crash` within 1 s.
  - `score table shows engine output`: rows Gemini-2.5 0.883, DeepSeek-R1 0.881, Hawkes-HFT 0.234, MM-Alpha 0.000 struck through with the words `liquidated at the 5% margin limit`; Precise shows the PSR / Calmar / Survival columns.
  - `proof rows reach five of five`: scroll chapter 06 to 60% and assert the verdict `5 / 5 identical`; the button `Verify it yourself in the app` links to `/app/proof`.
  - `barrier holds the clock`: at 60% through chapter 04 the clock reads `market held`.
- [ ] **Step 2:** Run them and confirm they fail.
- [ ] **Step 3:** Build the chapters:
  - 01 impact: range 1–45 ETH and "Send it" fires the order slug.
  - 02 venues: readouts from `scene.status`.
  - 03 chaos: the mood selector plus a 2D-canvas λ trace (240 samples at 12 Hz).
  - 04 barrier: the 0–42% / 42–86% / 86–100% scroll mapping.
  - 05 score.
  - 06 proof: rows light between 6% and 56%, cards merge between 58% and 90%.
  - Mobile hash rows: show the hash truncated to `4ee5fa37…58725614` at 12px under 860px.
- [ ] **Step 4:** Run the e2e tests → PASS.
- [ ] **Step 5:** Commit `feat(web): landing interactions (impact, venues, chaos, barrier, score, proof)`.

### Task 8: The gate at `/enter`

**Files:**
- Create: `src/components/gate/{Gate,BootList}.tsx`, `e2e/gate.spec.ts`
- Modify: `src/app/enter/page.tsx`

**Interfaces:**
- Consumes: `CanyonCanvas mode="gate"`, `StatusLine`, `TopBar` (gate variant: "Back to the overview" link to `/`).

- [ ] **Step 1:** Write the failing tests:
  - `gate boots then offers entry`: after 3 s, `Continue as guest` is focused and links to `/app`; `Sign in (coming soon)` is disabled; the three boot lines read `done`.
  - `gate reduced motion`: with `?rm` the final state is present immediately.
- [ ] **Step 2:** Run them and confirm they fail.
- [ ] **Step 3:** Implement one GSAP timeline of 2.6 s exactly per guide §5 Gate (seed numeral, level rise, camera descent, history extrusion, nodes, title mask reveal at 2.30 s, buttons at 2.55 s); note copy `No account needed. Accounts arrive with hosting.`
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat(web): loading gate with guest entry and sign-in slot`.

### Task 9: New app shell with Simple / Pro

**Files:**
- Create: `src/components/app-shell/{AppShell,AppNav,AppStatusLine,CommandMenu,DensitySwitch}.tsx`, `src/lib/density.ts`, `src/lib/density.test.ts`, `e2e/app-shell.spec.ts`
- Modify: `src/app/app/layout.tsx`
- Delete: `src/components/shell/`

**Interfaces:**
- Consumes: `useArena()`, `APP_ROUTES`.
- Produces: `useDensity(): ['simple'|'pro', (d) => void]` (default `simple`, persisted in `localStorage['apex-density']`); `<Pro>{children}</Pro>` renders children only in Pro; `<Simple>` the inverse.

- [ ] **Step 1:** Write the failing tests:
  - unit `density defaults to simple`.
  - e2e `density toggle persists`: switch to Pro, reload, still Pro.
  - e2e `command menu navigates`: ⌘K → type `bench` → Enter → URL `/app/benchmark`.
  - e2e `keys 1–4 navigate`.
- [ ] **Step 2:** Run them and confirm they fail.
- [ ] **Step 3:** Build the shell with shadcn primitives and the landing tokens:
  - Top bar: wordmark (links to `/`), AppNav (Arena, Agents, Benchmark, Proof), DensitySwitch (shadcn ToggleGroup), pause/resume, ⌘K CommandMenu (shadcn Command in a Dialog).
  - Header tinted by the regime horizon light (calm haze → hot).
  - The landing's status line style replaces the status bar.
  - Toasts restyled to 2px radius on ink-2.
  - Keep the user's demo banner logic if it exists (render it inside the new shell).
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat(web): new app shell with Simple/Pro density`.

### Task 10: Re-skin the four app pages and remove the legacy styles

**Files:**
- Modify: `src/components/arena/*`, `src/components/lab/*`, `src/components/bench/*`, `src/components/arch/*`, `src/components/views/*`, `src/components/ui/index.tsx` (Panel, KpiCard, ConceptPill, Badge, Meter, Segmented, Tabs re-implemented on Tailwind + shadcn with the same props)
- Delete: every `*.module.css` under `src/components`, `src/styles/legacy.css` and its import in `src/app/app/layout.tsx`
- Test: `e2e/app-pages.spec.ts`

**Interfaces:**
- Consumes: `useDensity`, `<Pro>`, `Leaderboard`, `WeightBar`, `HashRows` (Task 7).
- Simple shows: Arena = chart, order book, order ticket, leaderboard; Agents = reasoning traces, agent builder; Benchmark = run button, stage pipeline, scorecard; Proof = the Rust 5-run check (rendered with `HashRows`, verdict mint/vermilion). Pro reveals everything else that exists today (spec §5.5).

- [ ] **Step 1:** Write the failing tests:
  - `simple hides advanced panels`: on `/app` in Simple, the "AMM swap" tab and the "MacroDigest" panel are absent; in Pro they are present.
  - `benchmark runs`: click Run, a scorecard row for MM-Alpha shows `F / Liquidated` within 15 s.
  - `proof verifies`: click "Verify 5-run Rust determinism" and 5 rows show `4ee5fa37` and the verdict `5 / 5 identical`.
  - `chart survives reset`: Pro → Stress lab → Reset; no console error mentioning `lightweight-charts`.
  - `no legacy styles`: no element has a class matching `/module__/`.
- [ ] **Step 2:** Run them and confirm they fail.
- [ ] **Step 3:** Re-skin each page per guide §5 "Carrying the language into the app":
  - Panels: ink-2 ground, 1px rule border, 2px radius, 13px Archivo titles, Martian Mono numerals.
  - Order book: depth bars at 18% alpha.
  - lightweight-charts: bone outlines with mint / vermilion bodies and amber regime bands; monotonic-time guards kept.
  - Reasoning traces: 12px mono with a bone left rule.
  - MacroDigest header reuses the tick strip.
  - Wrap advanced panels in `<Pro>`.
  - Behaviour and `useArena()` calls stay unchanged.
- [ ] **Step 4:** Run `bun run test:e2e` (all specs) → PASS; `bun run test` → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(web): re-skin arena, agents, benchmark and proof; remove legacy CSS`.

### Task 11: Quality pass, documentation and full gates

**Files:**
- Modify: `CLAUDE.md` §4 web map (new routes and folders), `README.md` (web workstation section: routes, `gen:real`, `test`, `test:e2e`), `docs/screenshots/*` (recapture), `PRODUCT.md` only if facts changed
- Create: `DESIGN.md` + `.impeccable/design.json` (via the impeccable documenter), `.impeccable/review/{desktop,mobile}.png`

- [ ] **Step 1:** Capture 1440×900, 1280×800 and 390×844 screenshots of `/` (hero + every chapter), `/enter`, and each `/app` page in Simple and Pro, plus `?rm`. Rotate a 390×844 viewport to landscape mid-scroll on `/` and confirm the camera re-frames and labels stay inside the viewport (Review Focus 4). Fix what the round shows; do at most two rounds.
- [ ] **Step 2:** Measure frame rate on `/` in the real Browser pane (rAF counter over 5 s in chapters 00, 03, 06) and record it in the PR notes; confirm the DPR fallback triggers when CPU is throttled 6× in DevTools.
- [ ] **Step 3:** Run `impeccable detect --json` on changed UI files; fix mechanical findings; spawn the impeccable finish reviewer with the direction contract (`.impeccable/surfaces/apps-web-arena-src-app-page-tsx.md`), the screenshots, and `docs/design/landing/screens/hero.png` as the critique reference; apply its fix batch once.
- [ ] **Step 4:** Spawn the impeccable documenter to write `DESIGN.md` and `.impeccable/design.json` from the built world.
- [ ] **Step 5:** Run every gate:
  - `./scripts/verify_determinism_hook.sh` → `PASS: 5-Run SHA-256 State Equivalence Verified.`
  - `PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -q` → `4 passed`
  - `bun run typecheck` → clean
  - `bun run test` → all pass
  - `NEXT_DIST_DIR=.next-build bun run build` → success
  - `bun run test:e2e` → all pass
  - `curl -s -X POST localhost:3000/api/arena -d '{"action":"verify_rust_determinism","seed":42,"ticks":300}'` → `all_equal: true`
- [ ] **Step 6:** Update CLAUDE.md, README.md and the screenshots; run `graphify update .`; commit `docs: document the Canyon redesign and refresh screenshots`.
