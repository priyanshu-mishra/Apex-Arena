# ApexArena landing: design guide

## 0. Design plan (written before any code)

**Thesis: "The Canyon".** The market is drawn as the thing a quant already knows, a depth chart, extruded through time into a landscape. Price runs left to right, resting order size rises upward, time recedes to the horizon. Buy orders form the left wall, sell orders the right wall, and the gap between them (the spread) is the canyon floor, with the last price running along it as a bright thread. Every particle is a resting order on a real price level; every rib across the canyon is a one-second barrier; a crash is a visible wound that opens at "now" and travels into the past. Agents hover in front of the "now" face and are wired to the two venues (order book and on-chain pool), so the network graph is the real topology, not decoration.

**Signature moment (first viewport).** Full-bleed canyon receding to a horizon glow, agents firing orders into the walls, then, a few seconds after load (or on the visitor's click), a flash crash: the near walls evaporate, the floor rips open in amber, the thread drops, and the scar flows down the canyon while the status line flips from calm to flash crash. The headline sits bottom-left as a film title over the empty foreground, not beside a "visual".

**Scroll = one scene re-staged.** Same canvas, ten camera/formation states: canyon (hero), front-on depth chart (impact, visitor sends an order through a real ladder), side-on with the x·y=k curve (two venues), high three-quarter (chaos, visitor triggers regimes), bullet-time freeze among the agents (the barrier, quiet), agents lifted to their score with one on the floor (score, dense), five stacked sheets collapsing into one (proof), plan view (stack, credit), flight into the canyon mouth (close).

**Type and colour.** Archivo variable (expanded for display, normal for text) plus Martian Mono for every number. Warm bone text on neutral black; colour only ever means data: mint = buy, vermilion = sell, blue = on-chain pool, amber = shock.

**Evidence, not claims.** The leaderboard, the order ladder, the price trace and the hash on the page are real output of `target/debug/apex-tui` (flash-crash, seed 42, 300 ticks). The live scene is labelled "simulated in your browser".

### Check against the rejected attempts

| Rejected trait | This plan |
|---|---|
| Left headline / right visual hero | Full-bleed scene; title anchored bottom-left over the foreground floor, callouts inside the scene |
| Starfield of random particles | Zero free particles. Every point is on a lattice: price level × tick slice. Columns trace level lines, rows are ticks |
| Thin 2D canvas network | 60k-point 3D terrain with depth of field; graph edges only where a real relation exists (agent ↔ venue) |
| Rounded dark cards with hairlines | No cards at all. Type and numerals sit on the scene; hairlines only as instrument rules; 2px radii |
| Mono pill chips | One persistent status line (terminal-style, bottom edge). No chips |
| Identical section rhythm | Sticky chapters of different lengths and compositions: one quiet, two dense, three interactive |
| Default dark-devtool feel (navy, cold white, Bricolage/Geist) | Neutral black + warm bone, expanded grotesk, condensed mono, film grain, horizon light |

First draft of this plan had a ring of 100 ticks orbiting a pulse for the two-clocks chapter and "four tiles" for the stack. Both could be guessed from "dark AI-tool landing page", so they were replaced: the ticks are the terrain rows themselves and scroll scrubs them to a freeze; the stack is four typographic rows.

### What the two review rounds changed

- Round 1 (first render): the title sat on top of the canyon, stepped rib lines made it read as wireframe, agent discs were oversized, half-screen scrims hid the scene, and every chapter was stuck in "flash crash". Fixed: camera looks down so the canyon owns the top 60% and the title the bottom 40%; ribs cut to 20% alpha; nodes shrunk; scrims made local to the text; idle shocks only fire in the hero and the close.
- Round 2: the impact and venues chapters had the "now" face cut off and unreadable history behind it; the score bars were off-screen; five stacked sheets were a tangle. Fixed: history dims to 10% and the camera follows the price in those chapters; score camera re-aimed; the five runs became five cards in a depth rack that slide into one, with the full history blooming back on merge.
- Round 3: mobile framing, 12px text floor, contrast of tertiary text, table wrapping in Precise mode, gate built.

---

## 1. Files

| File | What it is |
|---|---|
| `index.html` | Landing page prototype. One WebGL canvas, ten chapters, Plain/Precise, three interactions. |
| `gate.html` | Loading gate. 2.6 s boot, then "Continue as guest" + disabled "Sign in (coming soon)". |
| `screens/*.png` | Reference renders (1440×900 unless prefixed `mobile-`, which are 390×844 @2x). |

Run: `cd docs/design/landing && python3 -m http.server 4321`, open `http://localhost:4321/`. Flags: `?rm` forces the reduced-motion version, `?precise` opens in Precise.

Libraries (pinned): three 0.169.0 (unpkg ES module), GSAP 3.12.5 + ScrollTrigger (cdnjs), Google Fonts Archivo + Martian Mono.

## 2. Tokens

### Colour

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#050608` | Page ground, canvas clear colour |
| `--ink-2` | `#0A0C10` | Raised ground (app panels) |
| `--haze` | `#141A24` | Horizon light, calm (shader: rgb .078 .102 .141) |
| `--haze-hot` | `#29110A` | Horizon light during a shock (shader: rgb .16 .066 .024) |
| `--bone` | `#EDEAE3` | Primary text, primary button fill, price thread, agent nodes |
| `--bone-2` | `#A8A69F` | Secondary text (8.3:1 on ink) |
| `--bone-3` | `#8C8A84` | Tertiary text, captions (5.9:1 on ink) |
| `--rule` | `rgba(237,234,227,.13)` | Hairlines between rows |
| `--rule-2` | `rgba(237,234,227,.28)` | Section rules, control outlines |
| `--bid` | `#45E0BC` | Buy side, gains, "match" |
| `--ask` | `#FF5A45` | Sell side, losses, liquidation |
| `--pool` | `#6C9CFF` | On-chain pool only |
| `--shock` | `#FFB020` | Shock state only (regime dot, λ, scar) |
| `--grey` (scene) | `#7C8794` | Deep-book particles far from the touch |

Rules: the four data colours never appear on chrome (no coloured buttons, borders, glows). No purple anywhere. No gradients on text. The only gradients are the horizon light (in the shader), the vignette, and text scrims.

Tailwind v4: declare these in `@theme` as `--color-ink`, `--color-bone`, … and map shadcn: `--background: ink`, `--foreground: bone`, `--primary: bone`, `--primary-foreground: ink`, `--muted-foreground: bone-2`, `--border: rule-2`, `--ring: bone`, `--destructive: ask`, `--radius: 2px`.

### Type

| Role | Family | Settings | Size |
|---|---|---|---|
| Hero title (h1) | Archivo | wdth 122, wght 560, tracking −0.035em, leading 0.94 | `clamp(44px, 7.5vw, 122px)` |
| Chapter title (h2) | Archivo | same | `clamp(34px, 4.9vw, 78px)`; quiet chapter `clamp(28px, 3.6vw, 56px)` wght 500; close `clamp(52px, 12vw, 200px)` tracking −0.045em |
| Credit name | Archivo | wdth 122, wght 560, −0.04em | `clamp(44px, 8vw, 132px)` |
| Stack word | Archivo | wdth 122, wght 560, −0.03em | `clamp(26px, 3.2vw, 50px)` |
| Lede | Archivo | wdth 100, wght 400, leading 1.45, max 34em | `clamp(16px, 1.35vw, 20px)` |
| Body | Archivo | wdth 100, wght 400, leading 1.5 | 17px |
| Buttons, table names | Archivo | wdth 108–110, wght 560–600 | 13.5 / 16 / 19px |
| Big numerals | Martian Mono | wdth 80, wght 500, tracking −0.03em, tabular | `clamp(22px, 2.5vw, 38px)` |
| Hash rows | Martian Mono | wdth 75, wght 400, tabular | `clamp(8.5px, 1.62vw, 24px)` |
| Readouts, captions, status line, scene labels | Martian Mono | wdth 87.5, wght 400, tabular | 12px (floor) |

Rules: sentence case everywhere. No all-caps labels. Mono is for numbers, hashes, identifiers, the status line and scene labels; never for sentences of prose longer than a caption. Titles are set in `.ln` line wrappers (overflow hidden) and revealed by a 105% → 0 `yPercent` mask. `text-wrap: balance` on titles, `pretty` on ledes. Minimum text size 12px.

### Grid, spacing, radii

- 12 columns, `minmax(0,1fr)`, 24px gutters (12px under 860px). Page margin `--m: clamp(16px, 3.9vw, 56px)`. Left chapter rail reserves `--rail: clamp(0px, 5vw, 72px)`; hidden under 1100px.
- Stage padding: 84px top, `hud + 28px` bottom. Status line height 38px.
- Spacing scale: 6, 10, 12, 14, 18, 22, 26, 34 px. Title → lede 22px. Lede → precise 14px.
- Radii: 2px on every control. Nothing else is rounded. No cards, no shadows, no blur.
- Rules: 1px `--rule-2` above an instrument strip or a list; 1px `--rule` between rows.

## 3. The scene

One `<canvas>` fixed behind the page, one `WebGLRenderer` (WebGL2, `antialias:false`, `powerPreference:'high-performance'`, DPR capped at 1.75 desktop / 1.5 mobile). No post-processing passes: depth of field, glow and haze are done in the point shader and the background shader. Over the canvas, in CSS: a vignette (`radial-gradient(130% 95% at 50% 45%, transparent 55%, rgba(5,6,8,.72))`) and a static film grain (SVG `feTurbulence` 0.9, 2 octaves, 7% opacity, `mix-blend-mode: overlay`). All scene materials: additive blending, no depth test, no depth write.

### World

- x = price (0 = long-run mid), y = resting size, z = time. "Now" is the plane z = 0; history recedes to z = −64 (24 seconds). Half-book width `W = 7`, `NL = 14` price levels per side.
- Market model, identical in GLSL and JS (so the status line always matches the picture):
  - `midBase(t) = .9 sin(.13t) + .5 sin(.31t+1.3) + .22 sin(.83t+.7) + .07 sin(2.1t+2)`
  - Up to 8 events `(t, magnitude, direction)`. For a slice born at `tau`, with `dt = tau − t`: mid shift `dir·mag·2.6·(1−e^(−5dt))·(.4+.6e^(−.22dt))`; shock `s = mag·e^(−.55dt)`; half-spread `.16 + Σ s·1.5·(1−e^(−9dt))`.
  - Level height (cumulative depth) `lvl(l) = 3.6·(l/14)^1.3·(.85+.15 sin(.55tau + 1.9·side + .3l))`. Evaporation `clamp(shock)·e^(−3.2u)` removes 82% of height near the touch and lifts 45% of those points upward.
  - Shock intensity shown to the visitor: `λ = 0.20 + Σ mag·2.3·e^(−.55dt)` (a Hawkes kernel; 0.20 matches the real calm reading).

### Objects and what they mean

| Object | Geometry | Meaning |
|---|---|---|
| Terrain | 55,200 points desktop (120 tick rows × 46 columns × 2 sides × 5 run copies), 19,200 mobile. Lattice, not random: a column is a price level line, a row is one tick slice. 20% of columns are "risers" spread vertically between two levels. | Resting orders through time. Colour: grey → side colour as it nears the touch; amber where the slice was born in a shock. Alpha `(1−age)^1.9`. |
| Now face | 7,000 fill points (2,500 mobile) under the surface at age 0, plus a stepped outline (`LineSegments`) | The depth chart right now |
| Ribs | 24 stepped outlines, one per whole second of history, 20% alpha | The 1-second macro barrier |
| Price thread | 420-vertex line + bead chain along y = 0.02 at the mid; two fainter lines at best bid (mint) and best ask (vermilion) | Last price through time |
| Floor grid | Lines every 1.5 price units and every 4 z units, 7.5% alpha | Engineered ground, fixed prices |
| Agents | 5 nodes: bone core + soft halo; reasoning agents get a ring at 60% radius; pulse ring on action | Gemini-2.5, DeepSeek-R1 (reasoning), Hawkes-HFT, MM-Alpha (quant), You |
| Orders | 300 particles × 3 trail points on quadratic Béziers from an agent to a resting place on the now face (exponentially biased to the touch); mint = buy, vermilion = sell; they flare on arrival | Orders in flight |
| Pool | 2,200 points on y = k/x (20 rows deep), two axis lines, a bead for current reserves; origin (8, 0, −5), scale 1.6 | The x·y=k pool |
| Arbitrage stream | 60 blue particles between the bead and the touch, visible when the gap passes 22–40 bps | Agents closing the gap |
| Edges | Each agent → the touch (bone, 10% + pulse) and → the pool bead (blue, 4% + pulse) | The real topology: agents ↔ two venues |
| Stems | 4 vertical lines floor → node in the score chapter | Apex score as height (0.3 + ACS × 5.4) |
| Order slug | One mint node flying You → best ask in 0.55 s | The visitor's order |
| Background | Full-screen quad: ink + a horizon band (`e^(−dy²·9)` above, `·26` below) + a tight core, at the projected vanishing point; colour mixes calm → hot with shock | Light source and regime |

Point shader: size `uPx·0.036·(.65+.7·rnd)/distance` with a floor of 1.3 device px (alpha scaled down below the floor). Depth of field: `coc = clamp(|d−focus|/focus·aperture)`, adds up to 14 device px, softens the sprite edge, divides alpha by `1+30coc²`.

Time: thinking agents pulse together on every whole second of simulation time (the barrier, visible all page long). Idle shocks: one flash crash 4.2 s after load if the visitor has done nothing and is still in the hero; afterwards at most one event every ~30 s, only in the hero or the close.

### Chapter states

The frame loop blends `ST[i−1] → ST[i]` by how far chapter i's top has travelled from the bottom of the viewport to the top (`smoothstep(.08,.92)`), then eases the live values toward the blend with `1 − e^(−3.2·dt)`. Pointer parallax ±0.45 x, ±0.25 y. `follow` adds the current mid to camera x.

| # | Chapter | Camera pos | Target | FOV | Focus / aperture | Other |
|---|---|---|---|---|---|---|
| 00 | Canyon | −1.2, 5.2, 17.5 | 1.2, −0.6, −12 | 34 | 17 / .5 | everything on |
| 01 | Depth chart | 0.4, 2.6, 19 | 0.4, 2.35, 0 | 30 | 19 / 1.0 | history 10%, face ×2.4, follow 1 |
| 02 | Two venues | 3.4, 4.0, 23 | 3.4, 2.9, −4 | 32 | 24 / .6 | history 35%, pool ×1.5, follow .6 |
| 03 | Chaos | 10, 7.5, 13 | −1.5, 2.2, −14 | 36 | 22 / .4 | history ×1.25, agents off |
| 04 | Barrier | 5.2, 2.3, 7.2 | −1.2, 2.7, 0 | 32 | 6.5 / 1.1 | time freezes; camera orbits ±0.55 rad with scroll |
| 05 | Score | 5.5, 3.0, 24 | 5.5, 4.6, 3 | 36 | 21 / 1.2 | scene 30%, agents on stems, MM-Alpha vermilion on the floor, You hidden |
| 06 | Proof | −19, 6.5, 17 | 3.6, −1.0, −3 | 30 | 26 / .25 | five copies 4.2 apart in z, history 10% → 100% as they merge |
| 07 | The run | −4, 15, 22 | 3, 0, −22 | 34 | 34 / .3 | scene 75%, agents off |
| 08 | Credit | −2, 10, 20 | 3, 0, −22 | 34 | 30 / .4 | scene 70% |
| 09 | Flight | 0, 1.5, 6.5 | 0, 1.2, −30 | 52 | 10 / .5 | everything on |

Portrait (aspect < 0.8) uses a second table in the prototype (`const m` in `index.html`): cameras pulled back to z 22–44, FOV 44–62, score bars and agent labels off in chapters 1, 2 and 5.

### Performance budget

- One canvas, one render pass, ~20 draw calls, ~65k points, 240 CPU-updated edge vertices. Target 60 fps on an M-series MacBook at DPR 1.75; nothing allocates per frame except three small vectors (hoist them in the build).
- Mobile: rows 64, columns 30, fill 2,500, orders 150, pool 900, DPR 1.5.
- Pause when `document.hidden`. In the build, also pause when the canvas is fully covered (app route) and drop DPR to 1.25 if a 2-second average frame time exceeds 22 ms.
- No WebGL2: `html.no-gl` shows a static poster (gradient + three SVG strokes); all content remains.
- R3F mapping: one `<Canvas frameloop="always" dpr={[1,1.75]} gl={{antialias:false}}>`; each object above is one component with a `shaderMaterial`; shared uniforms live in one `useRef` object mutated inside a single `useFrame`; scroll state comes from a zustand store written by ScrollTrigger, never React state.

## 4. Motion

| Thing | Duration | Ease |
|---|---|---|
| Title line mask reveal | 1.1 s, 80–90 ms stagger | `expo.out` |
| Lede / controls reveal (opacity, 18px rise) | 0.9 s, 120 ms delay | `power3.out` |
| Scene build on load (`uExtent` 0 → 1: history extrudes away from "now") | 2.6 s | `power2.out` |
| Camera and scene values | continuous | exponential damping, rate 3.2/s |
| Order slug | 0.55 s | `power2.in` |
| Agent pulse decay | ×0.94 per frame | |
| Hover / press on controls | 0.2 s | `cubic-bezier(.2,.7,.1,1)`; press = 1px down |
| Hash row / verdict | 0.35–0.4 s opacity or colour | same |

Scroll mapping: sticky stages. Chapter heights in viewport units: 00 = 100, 01 = 190, 02 = 180, 03 = 190, 04 = 250, 05 = 190, 06 = 270, then normal flow. Chapter 04: scroll 0–42% fills the 100 ticks and slows time to 12%; 42–86% the market is held; after 86% it runs again. Chapter 06: rows 1–5 light between 6% and 56%; the five cards merge between 58% and 90%. Nothing animates that the visitor did not cause, except the slow life of the market itself and one opening crash. No bounce, no elastic, no parallax on text.

## 5. Components

### Landing

1. **Top bar**: wordmark (stepped-canyon glyph + "ApexArena"), Plain/Precise segmented control (`aria-pressed`, persisted in `localStorage['apex-depth']`), primary button. Fades to transparent; no border, no blur.
2. **Chapter rail** (≥1100px): nine ticks, active tick widens 10 → 26px and shows its label; labels of all appear on hover/focus. Links to `#c0…#c8`.
3. **Status line**: fixed 38px strip: seed, tick, ETH, spread, λ, regime (dot turns amber when not calm), "simulated in your browser". Drops fields under 860 and 520px.
4. **Stage** (`.chapter > .stage`): sticky 100svh, 12-col grid, three rows (head / free / instruments), with a text-local scrim variant (`-l`, `-r`, `-b`, `-c`, `-f`).
5. **Instrument strip** (`.inst`): rule on top, then readouts on the grid. A **readout** is caption (12.5px sans) + big numeral + mono sub-line. No boxes.
6. **Order control**: range input 1–45 ETH (1px track, 14×28px bone thumb, 2px radius) + "Send it". Walks the real ask ladder; outputs impact in bps, levels cleared, average fill.
7. **Mood selector**: four joined rectangular buttons in one outline, `aria-pressed`; pressed = bone fill, ink text.
8. **λ trace**: 2D canvas, 240 samples at 12 Hz, 2.5px amber line, 10% amber fill, baseline hairline.
9. **Tick strip**: 100 hairlines (every tenth taller) + clock line "fast clock 042 / 100 ticks … 10 ms each"; amber "market held · thinking agents answer" while held.
10. **Leaderboard**: plain table, hairline rows, name + role, profit, worst drop, big ACS numeral; liquidated row struck through with vermilion score. Precise adds PSR, Calmar, Survival columns and the formula. Weight bar: four segments 40/30/20/10 with captions.
11. **Hash rows**: five rows "run n · hash · match", dim (16%) until lit; verdict "n / 5 identical" turns mint at five; ghost button "Verify it yourself in the app".
12. **Stack rows**: big word / language (mono) / one sentence; Precise adds crate names.
13. **Credit**: "Designed and built by" + name at display size + text links (1px underline offset 5px).
14. **Close**: giant title + XL primary button + one sentence.
15. **Scene labels**: 12px mono with a 16px leader line, projected from 3D each frame; `left` variant flips the leader. Hidden under 860px except agent names.
16. **Buttons**: primary = bone fill, ink text; ghost = 1px `--rule-2` outline; sizes 34 / 52 / 68px high; 2px radius; the only decorated one is "Crash the market" with a 7px amber dot. No arrows.

### Gate

Full-bleed scene (same terrain, calm, one copy), top bar with "Back to the overview", status line, and a bottom panel: boot list left (cols 1–5), result right (cols 7–12, right-aligned).

Sequence, one GSAP timeline, 2.6 s:

| t (s) | What happens |
|---|---|
| 0.00 | Seed "42" (mono, wdth 75, `clamp(84px,15vw,220px)`) fades in at 38% height; line 1 "Seed 42 planted" lights |
| 0.25–1.15 | The now face rises level by level from the touch outward (`uRise`, `power3.out`) |
| 0.45–2.55 | Camera descends from a high plan view (y 21, z 27.5) into the hero framing (`expo.inOut`) |
| 0.70–1.20 | Seed number lifts 24px and fades |
| 0.90–2.20 | Line 2 "Order book and pool open"; history extrudes to the horizon (`uExtent`, `power2.inOut`); clock starts |
| 1.80–2.40 | Line 3 "Four agents awake. You make five."; nodes appear one after another |
| 2.30 | Title "The arena is open." mask-reveals (`expo.out`, 0.9 s) |
| 2.55 | Buttons and note fade up; focus moves to "Continue as guest" |

Buttons: "Continue as guest" (primary, 52px) and "Sign in (coming soon)" (`disabled`, dashed outline, tertiary text). Note: "No account needed. Accounts arrive with hosting." When auth exists, the disabled button becomes the ghost button and the note is removed; nothing else moves. Reduced motion: final frame at once, all three lines lit, no seed number, focus on the primary button.

### Carrying the language into the app

- Same tokens, type and 2px radius. Replace Inter with Archivo (wdth 100 for UI, 110–122 for titles) and JetBrains Mono with Martian Mono wdth 87.5 for numbers. Keep the 12px floor.
- Panels: `--ink-2` ground with 1px `--rule` borders and no shadow; a panel title is 13px Archivo wght 600 wdth 108, sentence case. The persistent status line replaces the current status bar one-to-one.
- **Arena**: the order book ladder uses mint/vermilion depth bars at 18% alpha behind tabular numbers; the chart keeps lightweight-charts with bone candles outline, mint/vermilion bodies, amber regime bands; the regime "weather band" becomes the horizon light colour of the app header (calm haze → hot).
- **Agent lab**: reasoning traces are mono 12px on ink with a bone left rule; the MacroDigest inspector reuses the tick strip (100 ticks → hold) as its header.
- **Benchmark**: the scorecard is the landing leaderboard component; each stage is a stack row; the weight bar is reused.
- **Proof view**: the hash rows component, wired to the real `verify_rust_determinism` action; verdict in mint or vermilion.
- A small (240px high) live canyon may sit at the top of the Arena view fed by the real worker frame; do not put the full scene behind dense UI.

## 6. Copy (final)

Top bar: ApexArena · Plain · Precise · Enter the arena
Rail: 00 The market · 01 Impact · 02 Two venues · 03 Chaos · 04 The barrier · 05 Score · 06 Proof · 07 Stack · 08 Credit
Status line: seed 42 · tick n · ETH n · spread n bps · λ n · calm | unsettled | flash crash | toxic flow | whale dump · simulated in your browser

**00** Title: A market that fights back.
Lede: ApexArena tests AI trading agents in a live simulated market. It reacts to every order, crashes on cue, and replays exactly.
Buttons: Enter the arena · Crash the market
Precise: Rust fixed-point L3 order book + embedded revm x·y=k pool + Markov-switching Hawkes regimes · 10 ms / 1 s dual-speed barrier · seed 42 → 5/5 identical SHA-256
Scene labels (Plain / Precise): buy orders waiting / bid depth · L3 price-time FIFO · sell orders waiting / ask depth · 14 price levels shown · the price / mid · between best bid and best ask · 8 seconds ago / t − 8 s · one rib per 1 s macro epoch · on-chain pool / AMM · x·y = k · revm · pool price / reserves (x, y). Agents: Gemini-2.5 reasoning · DeepSeek-R1 reasoning · Hawkes-HFT quant · MM-Alpha quant · You by hand (Precise: AiReasoning, QuantAlgo, manual desk).

**01** Title: A replay can't feel your order.
Lede: Most trading AIs are graded on recorded prices, where even a huge order changes nothing. Here it eats through the sell orders and the price moves.
Control: Your buy order · n ETH · Send it · Sell-side ladder from the Rust engine: seed 42, tick 300.
Readouts: In a replay · 0 bps · price never notices | In ApexArena · +n bps · n of 7 price levels cleared | Average fill · n · last price 2,142.31
Precise: Orders walk price-time FIFO levels in apex-clob (LIMIT, MARKET, POST_ONLY, IOC, cancel-newest STP). Prices and sizes are i64 fixed-point, SCALE = 10⁸. No floats.

**02** Title: Two venues. One coin.
Lede: An exchange-style order book and an on-chain pool both price the same ETH. When they drift apart, agents race to close the gap.
Readouts: Order book · n · price-time queue | On-chain pool · n · priced by formula | Gap · n bps · inside the fee: no trade / wider than the fee: agents trade it
Caption: Live values are simulated in your browser.
Precise: Pool: constant product x · y = k, 30 bps fee, executed in an in-memory revm 19.4 EVM (apex-evm). Atomic CLOB ↔ AMM arbitrage pays once the gap clears the fee.

**03** Title: Shocks breed shocks.
Lede: The market has four moods. Trigger one and watch it spread down the canyon, the way real panics feed on themselves.
Moods: Calm · Orderly quotes | Toxic flow · Informed bursts | Whale dump · 450 ETH into the pool | Flash crash · Liquidity vanishes
Readout: Shock intensity · n · λ, events per tick
Precise: Self-exciting intensity λ(t) = μ + Σ α·e^(−β(t−tᵢ)) under a Markov-switching regime chain: Calm, ToxicFlow, FlashCrash (350 bps liquidity evaporation), EvmShock (450 ETH whale swap).

**04** Clock: fast clock n / 100 ticks · market held · thinking agents answer · 10 ms each
Title: Every second, the market holds still.
Lede: Fast bots act every tick. Thinking models answer once a second, while the clock is stopped, so no one gets to see the future.
Precise: Fast loop Δt = 10 ms · macro epoch ΔT = 1 s = 100 ticks · every reasoning agent receives the same MacroDigest in virtual time; no wall clock anywhere in the kernel.

**05** Title: Profit isn't the score. Survival is.
Lede: Agents are graded on steady, risk-adjusted results. Lose past the margin limit and the score is zero, whatever came before.
Table head: Agent · Profit · Worst drop · (PSR · Calmar · Survival) · Apex score

| Agent | Role | Profit | Worst drop | PSR | Calmar | Survival | Apex score |
|---|---|---|---|---|---|---|---|
| Gemini-2.5 | reasoning agent | +95 bps | 120 bps | 0.9999 | 0.9500 | 0.9904 | 0.883 |
| DeepSeek-R1 | reasoning agent | +40 bps | 10 bps | 1.0000 | 1.0000 | 0.9034 | 0.881 |
| Hawkes-HFT | quant algorithm | −43 bps | 43 bps | 0.0000 | 0.2414 | 0.8095 | 0.234 |
| MM-Alpha | liquidated at the 5% margin limit | −470 bps | 915 bps | 0.0001 | 0.1560 | 0.0000 | 0.000 |

Weights: 40% Confidence it wasn't luck · 30% Drawdown control · 20% Stress survival · −10% Churn
Precise: ACS = 0.40·PSR(0) + 0.30·Calmar(capped) + 0.20·Survival(OOD) − 0.10·Penalty(turnover) · 5% maintenance-margin breach → liquidated, ACS = 0
Caption: Real engine output: flash-crash scenario, seed 42, 300 ticks. Agents are the arena's built-in entrants.

**06** Title: Five runs. One market.
Lede: Start from the same seed and the whole market replays, down to the last bit. Any result can be re-run and checked by anyone.
Rows ×5: run n · `4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614` · match
Verdict: n / 5 identical · Verify it yourself in the app
Precise: SHA-256 of the full kernel state after 300 ticks, seed 42. Output of apex-tui --verify-determinism; gate: ./scripts/verify_determinism_hook.sh. No floats, no hash maps, no wall clock.

**07** Title: Built end to end.
- Engine · Rust · The order book, the agents and the scoring. Whole-number maths only, so results never drift. · Precise: apex-types · apex-clob · apex-kernel · FixedPrice(i64) / FixedQty(i64), i128 intermediates · BTreeMap state · ChaCha8 RNG
- Pool · Rust + EVM · A real Ethereum virtual machine, embedded in the engine, running the on-chain market. · Precise: apex-evm · Bluealloy revm 19.4 + alloy-primitives · x·y=k, 30 bps
- Agents · Python · A Python SDK and a tool server, so any AI model can read the market and trade in it. · Precise: apex-py (PyO3) · MCP JSON-RPC 2.0, 7 tools: get_market_digest, get_orderbook_l2, submit_clob_order, execute_evm_swap, trigger_chaos_regime, get_leaderboard, verify_determinism
- Workstation · TypeScript · The live app: trade by hand, inject chaos, read each agent's reasoning, verify the proof. · Precise: apps/web-arena · Next.js 15, React 19 · in-browser kernel port in a WebWorker (its digest is FNV-1a; only the Rust kernel is SHA-256)

**08** Designed and built by · Priyanshu Mishra · GitHub (https://github.com/priyanshu-mishra) · LinkedIn (TODO: URL from the user) · Rust, Python and TypeScript, end to end.

**09** Title: Your turn. · Button: Enter the arena · Trade against the agents, crash the market, check the proof. No account needed.

Footer: ApexArena · MIT · the scene on this page is simulated in your browser; tables and hashes are real engine output · seed 42

**Gate**: Back to the overview · seed 42 · Seed 42 planted / Order book and pool open / Four agents awake. You make five. (each: done) · The arena is open. · Continue as guest · Sign in (coming soon) · No account needed. Accounts arrive with hosting. · Status: starting → open

### Truth ledger

| On the page | Source |
|---|---|
| Hash, 5/5 | `target/debug/apex-tui --verify-determinism --seed 42 --ticks 300` |
| Leaderboard and components | `apex-tui --scenario flash-crash --seed 42 --ticks 300 --json` → `leaderboard` |
| Ask ladder, last price 2,142.31 | same command → `book.asks`, `clob_mid_price` |
| λ baseline 0.20 | same → `hawkes_intensity_pips` in calm |
| Canyon, status line, pool gap, mood triggers | Simulated in the browser, labelled as such |

Re-run those commands and update the constants (`REAL` in `index.html`) whenever the kernel changes. In the build, generate them at build time into a JSON file rather than hand-copying.

## 7. Accessibility

- Contrast on `--ink`: bone 16.9:1, bone-2 8.3:1, bone-3 5.9:1, mint 12.2:1, vermilion 6.6:1, blue 7.6:1, amber 11.1:1. Text never sits on raw scene: every text block has a scrim.
- Focus: 2px bone outline, 3px offset, on every control and link. The gate moves focus to the primary button when it appears.
- The canvas, labels, grain and vignette are `aria-hidden`. Everything the scene shows is also in text: readouts, table (with caption), hash list (`role="img"` + label), status line (`role="status"`, `aria-live="off"` so it does not chatter).
- Colour is never the only signal: liquidated = strikethrough + words; match = the word "match"; regime = the word.
- Controls are native: `button`, `input[type=range]` with a label and `aria-describedby`, `aria-pressed` on toggles, `disabled` on the sign-in button.
- Reduced motion (`prefers-reduced-motion: reduce`, or `?rm`): no scene build, no reveals, no parallax, no auto shocks. The scene renders one designed still (a crash scar already in the canyon) and re-renders only on scroll, resize or an interaction; the camera cuts between chapter states instead of easing; a triggered shock steps time forward 1.6 s and redraws. See `screens/hero-reduced-motion.png` and `screens/gate-reduced-motion.png`.
- Keyboard: Tab order follows reading order; the rail and all three interactions are reachable; nothing traps scroll.

## 8. Responsive

| Width | Changes |
|---|---|
| ≥ 1100 | Full layout with rail |
| 860–1099 | Rail hidden; same grid |
| < 860 | Top-bar CTA hidden (the hero and close buttons remain); gutters 12px; every head spans 12 columns; instruments wrap to rows of thirds; moods become 2×2 without sub-labels; leaderboard drops Profit / Worst drop and moves to the bottom of the stage; hash rows drop the "match" column and shrink to 8.5px minimum (the hash is decorative at that size, the verdict carries the meaning); status line keeps seed, ETH, regime; scene note labels hidden; sticky chapters get +20vh |
| Portrait | Portrait camera table; score bars and agent labels off in chapters 1, 2, 5 |
| ≤ 390 | Verified at 390×844: no horizontal scroll, title `44px`, buttons stack |

## 9. Open items for the build

- LinkedIn URL (placeholder marked in the credit).
- App route for "Continue as guest" (prototype points at `http://localhost:3000/`).
- Whether the landing and gate become `/` and `/enter` with the app moving to `/arena`.
- Fonts: self-host Archivo and Martian Mono variable files with `next/font/local` and `font-display: swap`.
