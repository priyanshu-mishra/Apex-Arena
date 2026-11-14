---
name: ApexArena
description: A market that fights back. A deterministic trading arena drawn as a canyon of resting orders, on black ink with warm bone type and colour reserved for data.
colors:
  ink: "#050608"
  ink-2: "#0A0C10"
  haze: "#141A24"
  haze-hot: "#29110A"
  bone: "#EDEAE3"
  bone-2: "#A8A69F"
  bone-3: "#8C8A84"
  rule: "rgba(237, 234, 227, 0.13)"
  rule-2: "rgba(237, 234, 227, 0.28)"
  bid: "#45E0BC"
  ask: "#FF5A45"
  pool: "#6C9CFF"
  shock: "#FFB020"
  grey: "#7C8794"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(44px, 7.5vw, 122px)"
    fontWeight: 560
    lineHeight: 0.94
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 122"
  headline:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(34px, 4.9vw, 78px)"
    fontWeight: 560
    lineHeight: 0.94
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 122"
  title:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(28px, 3.2vw, 44px)"
    fontWeight: 560
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 122"
  lede:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(16px, 1.35vw, 20px)"
    fontWeight: 400
    lineHeight: 1.45
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  body-panel:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'wdth' 100"
  subhead:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
    fontVariation: "'wdth' 108"
  label:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.3
    fontVariation: "'wdth' 100"
  button:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1
    fontVariation: "'wdth' 108"
  numeral-big:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "clamp(22px, 2.5vw, 38px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 80"
  readout:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.01em"
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 87.5"
  seed:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "clamp(84px, 15vw, 220px)"
    fontWeight: 500
    lineHeight: 0.9
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 75"
rounded:
  control: "2px"
  inset: "1px"
spacing:
  page-margin: "clamp(16px, 3.9vw, 56px)"
  rail: "clamp(0px, 5vw, 72px)"
  gutter: "24px"
  gutter-narrow: "12px"
  status-line: "38px"
  s6: "6px"
  s10: "10px"
  s12: "12px"
  s14: "14px"
  s18: "18px"
  s22: "22px"
  s26: "26px"
  s34: "34px"
components:
  button-primary:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "34px"
  button-primary-lg:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 26px"
    height: "52px"
  button-primary-xl:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 38px"
    height: "68px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "34px"
  button-ghost-pressed:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "34px"
  button-disabled-soon:
    backgroundColor: "transparent"
    textColor: "{colors.bone-3}"
    rounded: "{rounded.control}"
    height: "52px"
  input:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    typography: "{typography.readout}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  segmented:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  segmented-pressed:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    typography: "{typography.readout}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "22px"
  panel:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    padding: "12px 0 16px"
  overlay:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
  status-line:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone-2}"
    typography: "{typography.readout}"
    height: "38px"
---

# Design System: ApexArena

## Overview

**Creative North Star: "The Canyon"**

The market is drawn as the thing a quant already reads, a depth chart, extruded through time into a landscape: price runs left to right, resting size rises, time recedes to a horizon light. Every point in the scene is a resting order on a real price level; every rib is a one-second barrier; a crash is a wound that opens at "now" and flows into the past. The interface around that scene behaves like an instrument laid over film: black ink, warm bone type, and colour that only ever means data.

Density is bimodal. The landing and the gate are sparse and cinematic, with display-scale titles anchored bottom-left over the empty foreground and the scene owning the rest of the frame. The app (Arena, Agents, Benchmark, Proof) is dense and tabular, but speaks the same language: hairline-ruled strips instead of boxes, condensed mono numerals, a persistent terminal-style status line along the bottom edge. Depth comes from light (a horizon glow that heats with the market regime), a vignette and a static film grain, never from shadows or blur.

Confirmed rejections, all visible in what shipped: no headline-beside-a-visual hero, no free-floating starfield particles, no rounded dark cards, no navy-and-cold-white devtool palette, no purple, no gradients on text.

**Key Characteristics:**
- Neutral black ink ground, warm bone text in three steps, hairline rules at two strengths.
- Four data colours (mint bid, vermilion ask, blue pool, amber shock) that never touch chrome.
- Archivo variable, expanded (wdth 122) for titles and normal width for text; Martian Mono, condensed, for every number.
- 2px radius on every control; nothing else is a shape.
- Hairline instrument strips, not cards; one status line, not chips on the landing.
- Light as depth: horizon glow, vignette, 7% film grain.

## Colors

A near-black, slightly cool ink carrying warm bone type, with four saturated data hues held in reserve for prices, venues and shocks.

### Primary
- **Bone** (`bone`): primary text, the primary button fill, the price thread and agent nodes in the scene, the 2px focus outline, the pressed state of every toggle. It is the brand colour: the interface's only "accent" is light-on-dark.

### Data (semantic, not decorative)
- **Mint Bid** (`bid`): buy side, gains, positive deltas, "match" and the 5/5 verdict, the calm regime dot.
- **Vermilion Ask** (`ask`): sell side, losses, liquidation, invalid input borders, destructive actions.
- **Pool Blue** (`pool`): the on-chain AMM only, and the arbitrage stream between pool and book.
- **Shock Amber** (`shock`): shock state only: the regime dot when not calm, λ traces, the crash scar, regime bands on the price chart, the 7px dot on "Crash the market".
- **Deep-Book Grey** (`grey`): scene particles far from the touch; never used for UI text.

### Neutral
- **Ink** (`ink`): page ground, canvas clear colour, input fill.
- **Ink Raised** (`ink-2`): the ground of floating layers only (command menu, mobile sheet, toasts).
- **Horizon Haze** (`haze`): the calm horizon light in the scene and app header; selected row in the command menu.
- **Horizon Hot** (`haze-hot`): the horizon light during a shock; the app header mixes haze to haze-hot by regime heat (calm 0, trending 35%, liquidity drought 65%, flash crash 100%).
- **Bone 2** (`bone-2`): secondary text, ledes, labels, unpressed toggles (8.3:1 on ink).
- **Bone 3** (`bone-3`): tertiary text, captions, key hints, placeholders (5.9:1 on ink).
- **Rule** (`rule`): hairlines between rows, badge outlines, tab baselines.
- **Rule 2** (`rule-2`): section rules above strips, control outlines, table header rules.

### Named Rules
**The Data-Only Colour Rule.** Mint, vermilion, blue and amber mean buy, sell, pool and shock, and nothing else. They never colour a button, border, glow or heading. If a colour is on screen, a number or a market object is behind it.

**The Words Carry It Rule.** Colour is never the only signal: liquidated rows are struck through and say so, matches say "match", the regime is a word beside its dot.

## Typography

**Display Font:** Archivo variable (wdth and wght axes), with ui-sans-serif fallback
**Body Font:** Archivo variable at wdth 100
**Label/Mono Font:** Martian Mono variable (wdth axis), with ui-monospace fallback

**Character:** An expanded, slightly tight grotesk for titles reads like a film title card; a condensed tabular mono for numbers reads like an instrument. The width axis does the work other systems give to weight.

Both families are led in their stacks by symbol supplements ("Archivo Symbols", "Martian Mono Symbols"), cut from the same variable fonts and limited by unicode-range to the arrows, math signs and super/subscript digits the copy uses (→ ≈ ≤ ≥ √ Δ μ ⁸ ₁–₅), so those glyphs never fall back to a system face.

### Hierarchy
- **Display** (560, `clamp(44px, 7.5vw, 122px)`, 0.94, wdth 122, −0.035em): the landing hero title only. The close title scales it to `clamp(52px, 12vw, 200px)` at −0.045em; the credit name to `clamp(44px, 8vw, 132px)` at −0.04em.
- **Headline** (560, `clamp(34px, 4.9vw, 78px)`, 0.94, wdth 122): landing chapter titles and the gate's "The arena is open." The quiet barrier chapter drops to `clamp(28px, 3.6vw, 56px)` at weight 500.
- **Title** (560, `clamp(28px, 3.2vw, 44px)`, 0.98, wdth 122, −0.03em): app page titles. Landing stack words use the same voice at `clamp(26px, 3.2vw, 50px)`.
- **Lede** (400, `clamp(16px, 1.35vw, 20px)`, 1.45, max 34em, bone-2): one paragraph under a title; bold runs lift to bone at 500. App ledes run `clamp(15px, 1.15vw, 17px)` at max 62ch.
- **Body** (400, 17px, 1.5): page default; inside app panels 14px / 1.55 in bone-2.
- **Subhead** (600, 13px, wdth 108): panel titles, toast titles, explain-region headings. Sentence case.
- **Label** (400, 12.5px, 1.3, bone-2): field labels, readout captions, segmented options on the landing.
- **Button** (600, 13.5px, wdth 108): 16px at 52px height, 19px at 68px.
- **Big Numeral** (Martian Mono 500, `clamp(22px, 2.5vw, 38px)`, wdth 80, −0.03em, tabular): readout values, Apex scores, KPI values (app: `clamp(22px, 2vw, 30px)`).
- **Readout** (Martian Mono 400, 12px, wdth 87.5, tabular): status line, captions with numbers, the Precise layer, scene labels, badges, code.
- **Seed** (Martian Mono 500, `clamp(84px, 15vw, 220px)`, wdth 75): the gate's seed numeral, once.

### Named Rules
**The Mono Is For Numbers Rule.** Martian Mono sets numbers, hashes, identifiers, the status line, scene labels and the Precise layer. It never sets a sentence of prose longer than a caption.

**The 12px Floor Rule.** No text renders below 12px anywhere. (The hash rows' shrink below that on phones is decorative; the verdict carries the meaning.)

**The Sentence Case Rule.** Titles, buttons, labels and status words are sentence case. Titles use `text-wrap: balance`; ledes and body use `pretty`.

## Layout

The landing is one fixed WebGL canvas behind a column of sticky chapters of different lengths (100 to 270 viewport units). Each chapter's stage is a sticky 100svh, 12-column grid (`minmax(0, 1fr)`, 24px gutters, 12px under 860px), three rows (head, free space for the scene, instruments), padded 84px top and status-line + 28px bottom. The page margin and the left chapter rail use the `page-margin` and `rail` tokens; the rail disappears under 1100px. Text blocks sit on the scene only behind a text-local scrim (left, right, bottom, centre or full-width variants of ink gradients), never a half-screen panel.

The app is a sticky 56px header (max 1720px, same page margin) over a single column of hairline strips, gaps 20px (24px at md). Dense views lay strips in grid columns; tables are plain and hairline-ruled with numerals right-aligned.

Rhythm comes from a small irregular scale (6, 10, 12, 14, 18, 22, 26, 34 px): title to lede 22px, lede to Precise 14px, instrument rows 26px apart.

Responsive: at 860px and below the top-bar CTA hides, every head spans 12 columns, instruments wrap to thirds, the mood selector becomes 2×2, the leaderboard drops columns and the status line keeps only seed, ETH and regime (520px trims further). Portrait aspect (< 4/5) uses its own camera table. Verified at 390×844 with no horizontal scroll.

## Elevation & Depth

The system is flat; depth is light. There are no shadows and no blur anywhere in the shipped surfaces. Depth comes from the scene (point-shader depth of field, a horizon band at the vanishing point that heats from haze to haze-hot with the regime), a fixed vignette (`radial-gradient(130% 95% at 50% 45%, transparent 55%, rgba(5,6,8,.72))`) and a static SVG film grain (feTurbulence 0.9, 2 octaves, 7% opacity, overlay blend). Floating layers (command menu, mobile sheet, toasts) separate by the ink-2 ground plus a hairline, not by a shadow. The landing top bar fades from 78% ink to transparent with no border.

### Named Rules
**The Light Not Lift Rule.** Nothing casts a shadow. If a layer must float, give it ink-2 and a rule-2 hairline; if a region must feel hot, change the horizon light.

**The Scrim Is Local Rule.** Text on the scene sits on a scrim shaped to that text block. The scene is never hidden behind a full-width panel.

## Shapes

Every control (buttons, inputs, selects, segmented groups, badges, key hints, the command menu, toasts) has a 2px corner. Segments inside a joined group step in to 1px. Theme radius tokens are all mapped to 2px, so library primitives cannot round further. Surfaces have no shape at all: an app panel is a 1px rule-2 line on top and content on the page ground, with no border box, fill or radius. Rules come at two strengths: rule-2 above a strip, list or table head; rule between rows. The range control is a 1px track with a tall bone rectangular thumb. The wordmark is a stepped-canyon glyph.

Data dots are the one exception: small solid markers for regimes and tones (6–7px). Landing and toasts draw them round; the app kit draws them as 7px squares with a 1px corner. Match the surface you are extending.

## Components

### Buttons
Bone slabs and hairline outlines, pressed 1px down; confident and quiet.
- **Shape:** 2px corner; heights 30 (app small), 34, 52 and 68px.
- **Primary:** bone fill, ink text, Archivo 600 wdth 108. Hover lightens (landing to white, app to 90% bone).
- **Ghost:** transparent with a 1px rule-2 outline, bone text; hover turns the outline bone. When used as a toggle, pressed fills bone with ink text.
- **Quiet:** text only in bone-2, hover to bone.
- **Hover / Focus / Press:** 0.2s `cubic-bezier(.2,.7,.1,1)` on colour, border and transform; active presses 1px down; focus is a 2px bone outline at 3px offset on every control.
- **Unavailable-for-now:** dashed 1px rule-2 outline, bone-3 text, `disabled` (the gate's "Sign in (coming soon)").
- **The only decorated button** is "Crash the market", carrying a 7px amber dot. No arrows on buttons.

### Segmented control and tabs
- **Segmented:** one 2px rule-2 outline holding joined segments split by rule hairlines; unpressed bone-2, pressed bone fill with ink text (`aria-pressed`). Used for Plain/Precise, Simple/Pro, moods, order types, sizes.
- **Tabs:** a rule baseline; tab labels in bone-2 at 13.5px 600; the selected tab gets a 1px bone underline and bone text.

### Inputs / Fields
- **Style:** 34px, ink fill, 1px rule-2 outline, 2px corner, Martian Mono 13px tabular for numeric entry (selects switch to Archivo).
- **Focus:** outline turns bone; hover turns bone-3.
- **Error / Disabled:** vermilion border on `aria-invalid`; 50% opacity disabled.
- **Range:** 1px rule-2 track, bone rectangular thumb with a 2px corner.

### Panels and instrument strips
- **Corner Style:** none.
- **Background:** the page ground (transparent).
- **Shadow Strategy:** none (see Elevation).
- **Border:** a single 1px rule-2 line on top.
- **Internal Padding:** 12px above and below the label row; content 4px top, 16px bottom.
- A panel is a labelled region: 13px subhead title, optional bone-2 subtitle, actions to the right, and an optional "?" ghost button that opens a three-column What / How to use / Under the hood note between rule hairlines.
- A **readout** (KPI) is a rule-2 top line, a 12.5px label (with an optional tone dot), a big mono numeral, and a mono sub-line. No boxes.

### Badges (app only)
- **Style:** 22px, 1px rule outline, 2px corner, Martian Mono 12px bone-2, optional tone dot. Used sparingly for live state (live, tick, block, spread, regime) in dense app views.

### Tables
Plain tables with a rule-2 header rule and rule row hairlines; header in 12px bone-2 regular; names in Archivo, values in tabular mono, right-aligned; the big Apex score numeral at the row's end. A liquidated row is struck through with its score in vermilion and the words "Liquidated at the 5% margin".

### Navigation
- **Landing top bar:** wordmark, Plain/Precise segmented control, primary "Enter the arena"; fades from ink to transparent, no border or blur.
- **Chapter rail (≥ 1100px):** a column of 10px bone-3 tick lines; the active tick widens to 26px and shows its mono label.
- **App header:** wordmark at wdth 118, section links with mono key hints (1–4), Simple/Pro switch, ghost Pause and Commands (⌘K) buttons; its background runs from ink to the regime's horizon colour with a 1s transition. Under md the sections move to a Menu sheet on ink-2.

### Status line (signature)
A fixed 38px strip along the bottom edge in 12px Martian Mono: seed, tick, ETH, spread, λ, regime (a dot that is mint when calm and amber when hot, beside the regime word), and "simulated in your browser". Cells divide with rule hairlines; values lift to bone at 500. It drops optional cells at 860px and 520px. It replaces chips, badges and footers on the landing and gate.

### Scene labels (signature)
12px mono labels with a 16px leader line, projected from the 3D scene each frame, flipping side when needed; hidden under 860px except agent names.

### Hash rows (signature)
Five rows of "run n · hash · match" in condensed mono, dimmed to 16% until lit; the verdict "n / 5 identical" turns mint at five.

## Do's and Don'ts

### Do:
- **Do** set every number, hash and identifier in Martian Mono with tabular figures at wdth 87.5 (wdth 80 for big numerals).
- **Do** keep chrome in bone, bone-2, bone-3 and the two rules; reach for mint, vermilion, blue or amber only when a market value or object is shown.
- **Do** build app surfaces as hairline-ruled strips: one rule-2 line on top, a 13px subhead, content on the ink ground.
- **Do** use 2px corners on every control and nothing larger.
- **Do** put text that overlaps the scene on a local scrim shaped to that text.
- **Do** show focus as a 2px bone outline at 3px offset.
- **Do** keep the 12px text floor and sentence case everywhere.
- **Do** honour reduced motion: the scene renders one designed still and the camera cuts between states.

### Don't:
- **Don't** put a data colour on a button, border, glow or heading.
- **Don't** use shadows, backdrop blur or rounded cards; floating layers get ink-2 and a hairline.
- **Don't** set prose in mono or titles in all caps.
- **Don't** use purple, navy-and-cold-white, or gradients on text.
- **Don't** scatter free particles or decorative graph edges in the scene; every point is an order on a level and every edge is a real agent-to-venue relation.
- **Don't** place a headline beside a decorative visual; titles sit over the scene's foreground.
- **Don't** add arrows to buttons or decorate any button except "Crash the market" with its amber dot.
