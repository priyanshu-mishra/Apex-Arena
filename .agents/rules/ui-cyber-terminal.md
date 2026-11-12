---
description: Enforces the Obsidian Microstructure design system, zero-radius tabular layout, and WebWorker SharedArrayBuffer telemetry pipeline for the Next.js Web Arena.
globs:
  - "apps/web-arena/**/*"
---

# Obsidian Microstructure UI & Telemetry Rules (`apps/web-arena/**/*`)

1. **Color Palette & Tokens**:
   - `--bg-void`: `#050505` (Main application canvas)
   - `--bg-panel`: `#0B0C10` (Quadrant containers and cards)
   - `--bg-elevated`: `#12151D` (Table headers and active rows)
   - `--border-grid`: `#1C202B` (`1px solid` dividers, `0px` border-radius)
   - `--border-focus`: `#38BDF8` (Active pane selection outline)
   - `--text-primary`: `#F3F4F6` | `--text-secondary`: `#9CA3AF` | `--text-muted`: `#4B5563`
   - `--color-bid`: `#00F59B` | `--color-ask`: `#FF2E54` | `--color-evm`: `#38BDF8` | `--color-chaos`: `#F59E0B` | `--color-llm`: `#A855F7`

2. **Typography & Geometry**:
   - Enforce `border-radius: 0px` across all panels, badges, buttons, and inputs.
   - Apply `font-variant-numeric: tabular-nums` on every price, volume, spread, PnL, and tick counter element to guarantee zero horizontal layout jitter at 60Hz.

3. **Off-Main-Thread Telemetry Architecture**:
   - Ingest high-frequency tick updates via a Dedicated WebWorker (`src/workers/arena.worker.ts`) writing into a `SharedArrayBuffer` (with clean fallback to typed array transfers when cross-origin isolation is unavailable).
   - Synchronize React/Canvas UI updates at 60Hz using `requestAnimationFrame`.
