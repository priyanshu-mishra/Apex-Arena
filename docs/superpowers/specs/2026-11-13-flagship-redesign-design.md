# ApexArena flagship redesign: design spec

Status: approved direction ("The Canyon", user-approved 2026-11-13). Visual source of truth: `docs/design/landing/DESIGN_GUIDE.md` and the working prototype `docs/design/landing/{index,gate}.html`. Product truth: `PRODUCT.md`.

## 1. Intent

ApexArena's web app currently feels bloated: every panel, metric and control is visible at once, and the visual language reads as a generic dark dashboard. The site will be seen by many first-time visitors, mostly recruiters and hiring managers, plus quants and engineers who want depth. The redesign must:

- get the core message across in seconds with one guided landing page;
- let a visitor raise the complexity on demand (Plain / Precise on the landing page, Simple / Pro in the app);
- look like the work of an expert design studio, not an AI-generated template;
- separate the story (landing page) from the tool (app) with a deliberate gate that will later host sign-in.

## 2. Goals, non-goals, anti-goals

**Goals**
1. A production landing page at `/` that faithfully implements the prototype: one WebGL canvas re-staged over ten chapters, three interactions (order slider, mood triggers, barrier scrub), the Plain / Precise switch, final copy, and real engine data.
2. A gate at `/enter` (2.6 s boot sequence, "Continue as guest", disabled "Sign in (coming soon)") that leads into the app.
3. The app moved to `/app` and re-skinned in the same visual language, with a Simple / Pro density switch that hides advanced panels by default.
4. A modern front-end stack: Tailwind CSS v4, shadcn/ui (Radix), GSAP + ScrollTrigger, three.js, zustand.
5. All existing quality gates stay green: Rust determinism, Python tests, typecheck and production build.

**Non-goals (this round)**
- Hosting, deployment and authentication: deferred by the user. The gate keeps a disabled sign-in slot only.
- The GitHub Pages static demo (the user's uncommitted `NEXT_PUBLIC_STATIC_DEMO` / `build:pages` / `.github/workflows/pages.yml` work): ignored this round by the user's decision. The build targets the local Next.js server with the Rust binary, Python and COEP headers present; `build:pages` may break and is re-done with hosting later. The user commits those changes themselves before implementation starts; the builder must not overwrite or revert them, only build on top.
- Changes to the Rust kernel, Python SDK or MCP server.
- New simulation features in the browser worker beyond what the landing page needs.

**Anti-goals (failure even if it works)**
- Any of the rejected tells: glow blobs, glass cards, bento icon grids, a centred headline over a screenshot, all-caps eyebrows, random starfields, gradient text, rows of identical rounded cards.
- Text below 12px, or claims the evidence does not support (see the truth ledger in the guide).
- A landing page that stutters: the scene must hold its frame budget or degrade gracefully.

## 3. Constraints

- Determinism invariants in `CLAUDE.md` are untouched. Charts keep strictly ascending, de-duplicated timestamps.
- `next.config.ts` sends `Cross-Origin-Embedder-Policy: require-corp`, so every font, script and asset must be same-origin or CORP-compatible. Fonts are self-hosted (`next/font`); three.js and GSAP come from npm, never a CDN.
- `/api/arena` keeps its four actions and response shapes; it still needs the compiled `apex-tui` binary and Python on the server.
- The browser worker's digest is FNV-1a, not SHA-256. Copy must keep that distinction.
- Every number shown as engine output must come from the Rust binary (truth ledger), not be hand-typed.

## 4. Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **A. Imperative scene engine + React shell** (chosen) | Port the prototype's three.js scene to a typed, framework-free `CanyonScene` class (same shaders, same model maths) mounted by one client component. React, Tailwind and shadcn own all DOM; GSAP ScrollTrigger writes scroll progress into a zustand store the scene reads each frame. | Keeps pixel and shader fidelity with the approved prototype, avoids per-frame React work, and is the lowest-risk port. |
| B. Full rewrite into react-three-fiber components | One R3F component per scene object, as the guide suggests. | More idiomatic, but rewriting 10 custom shader objects risks drifting from the approved look, and it adds a reconciler to a 60k-point per-frame scene for no visual gain. Kept as an option for small app-side canvases. |
| C. Ship the prototype HTML as a static page | Fastest. | Rejected: no shared tokens, components or routing with the app, CDN scripts break under COEP, and it can't be maintained. |

The user handed implementation choices to the builder; approach A is the builder's call.

## 5. Decisions

### 5.1 Routes and app structure
- `/`: landing page (server component shell + client chapters).
- `/enter`: gate.
- `/app`: the app, with nested routes `/app` (arena), `/app/agents`, `/app/benchmark`, `/app/proof`. One `app/app/layout.tsx` owns `ArenaProvider`, so the simulation worker survives navigation between app pages. The old in-app "Overview & tour" view is retired; the landing page replaces it. Keys 1–4 and ⌘K still switch pages.
- "Continue as guest" links to `/app`; "Verify it yourself in the app" links to `/app/proof`.
- The worker does not start on `/` or `/enter`; the landing page runs only its own lightweight scene model.

### 5.2 Stack
- Tailwind v4 (`@tailwindcss/postcss`) with the guide's tokens in `@theme`; shadcn/ui initialised for Button, Toggle Group, Tabs, Table, Tooltip, Dialog/Command (⌘K), Slider, Switch, Sheet (mobile nav), with the guide's shadcn variable mapping and `--radius: 2px`.
- `three` and `gsap` (+ `@gsap/react`, ScrollTrigger) from npm; `zustand` for scene state; `lenis` is not used (native scroll keeps sticky chapters predictable).
- Fonts: Archivo (variable, with width axis) and Martian Mono (variable) self-hosted through `next/font`. Inter and JetBrains Mono are removed.
- The old global CSS design system (`globals.css` "Obsidian Desk") and the CSS modules are replaced by Tailwind utilities and shadcn components as each surface is rebuilt; nothing old is left half-styled.

### 5.3 Landing page architecture
- `lib/canyon/model.ts`: the market model shared by the shaders and the status line (`midBase`, events, half-spread, level heights, λ), as typed pure functions.
- `lib/canyon/scene.ts`: the `CanyonScene` class (renderer, objects, shaders as `.glsl` strings, chapter state table, camera damping, pointer parallax, reduced-motion still, no-WebGL fallback, pause when hidden, adaptive DPR).
- `lib/canyon/store.ts`: a zustand store holding chapter index, progress, depth mode (Plain/Precise), the active mood and the visitor's order.
- `components/landing/*`: TopBar, ChapterRail, StatusLine, Stage, InstrumentStrip / Readout, OrderControl, MoodSelector, LambdaTrace, TickStrip, Leaderboard, HashRows, StackRows, Credit, Close, SceneLabels. Copy lives in one typed `content.ts` with Plain and Precise variants.
- `scripts/gen-real-data.ts` (run by `bun run gen:real`, also before `build`): calls `target/debug/apex-tui` and writes `src/lib/canyon/real.json` (hash, leaderboard and components, ask ladder, last price, λ baseline). A checked-in copy keeps the build working without the binary: when the binary is missing the script prints a warning and keeps the existing file (never fails the build); when the binary's output differs from the checked-in copy it rewrites the file and says so. (Builder check confirmed the binary's JSON carries every ledger field: leaderboard values, last price 2,142.31, calm λ 0.20, `4ee5fa37…` 5/5; the 7-level ask ladder holds ~47.5 ETH, so the 1–45 ETH slider fits.)

### 5.4 Gate
`app/enter/page.tsx` reuses `CanyonScene` with the gate timeline (one GSAP timeline, 2.6 s, as specified), reduced-motion final frame, and focus moved to "Continue as guest". The sign-in button is disabled with the note "No account needed. Accounts arrive with hosting." It is the future auth slot.

### 5.5 App re-skin and simplification
- The new shell replaces the AppShell: wordmark, page links (Arena, Agents, Benchmark, Proof), Simple / Pro switch, pause, ⌘K; the guide's status line replaces the status bar; the regime "weather band" becomes the header's horizon-light tint.
- **Simple** (default) shows only what tells the story: Arena = price chart, order book, order ticket and leaderboard; Agents = reasoning traces and the agent builder; Benchmark = run button, stage pipeline and scorecard; Proof = the Rust 5-run check. **Pro** reveals everything that exists today (KPI strip details, depth toggles, AMM swap, stress lab, receipts, MacroDigest JSON, head-to-head, per-stage heatmap, snapshot and MCP consoles, AMM and ACS calculators, architecture diagram).
- Panels follow the guide: `--ink-2` ground, 1px `--rule` borders, 2px radius, Archivo titles at 13px, Martian Mono numerals, the 12px floor. lightweight-charts keep their monotonic-time guards and adopt the data colours.
- Existing functionality and the `useArena()` contract are preserved; components are restyled and reorganised, not rewritten in behaviour.

### 5.6 Quality bar
- Desktop 1440×900 and 1280×800, mobile 390×844, and reduced motion are checked for every surface.
- Performance: one canvas, about 20 draw calls, around 65k points on desktop; 60 fps target on an M-series Mac; DPR drops to 1.25 after a 2-second average frame time over 22 ms; the scene pauses when hidden or off-route.
- Accessibility per guide §7: scrims under text, visible focus, aria labels, native controls, text equivalents for everything the scene shows.
- The impeccable detector runs on changed UI files; the mobile hash rows become a truncated 12px layout (the prototype's 8.5px exception is removed).

## 6. Open items (owner)
- LinkedIn URL (user). The credit shows a clear placeholder until it is supplied.
- Opening auto-crash: kept as in the prototype (plays once after 4.2 s if idle) unless the user opts out.
- App fonts: the app adopts Archivo + Martian Mono (builder's call, following the guide).

## 7. Left to the builder
Component boundaries inside each surface, test layout, how shaders are stored (inline template strings or `.glsl` via a loader), the exact Simple/Pro split within each panel where this spec is silent, and commit granularity (one checkpoint per phase at minimum).
