# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing Next.js 15 / React 19 / TypeScript app in `apps/web-arena`. The user pinned the redesign stack: Tailwind CSS (v4), shadcn/ui, GSAP, three.js, and Aceternity-style motion components, chosen per need. Hosting and authentication are explicitly deferred; the user will configure them later.

## Users

- **Primary: recruiters and hiring managers**, often non-technical, skimming a candidate's flagship project on a laptop between other tasks. Their job: understand within seconds what this is, believe it is serious engineering, and see who built it.
- **Secondary: quants, traders, software and ML engineers** (including technical interviewers) who want to verify depth: the market model, the determinism proof, the scoring maths, the code.
- Both audiences must be served by the same site: approachable by default, full technical depth on demand.

## Product Purpose

ApexArena is a deterministic, reactive market in which AI trading agents (LLM, RL, quant) are tested by the market itself rather than by replayed price history. Success for the website: a first-time visitor grasps the core idea from a single guided page and steps into the live app, where they can trade, inject chaos, inspect agents and verify determinism themselves.

## Positioning

Unlike CSV backtests, ApexArena couples a Rust fixed-point L3 order book with an embedded revm constant-product AMM under a Markov-switching Hawkes chaos engine, reacts to every agent's orders, freezes time at a 1-second barrier so slow models never see the future, scores agents with the Apex Composite Score (5% maintenance-margin liquidation = 0), and replays bit-for-bit from a seed (5 runs → identical SHA-256).

## Operating Context

- Entry is a single long guided landing page that explains the project and acts as the guide.
- A deliberate transition / loading gate separates the landing page from the app; it is the future slot for sign-in.
- Behind the gate: the working app (live arena, agent lab, chaos benchmark, architecture & determinism proof), driven by an in-browser simulation worker plus a server API that calls the native Rust binary and Python MCP server.

## Capabilities and Constraints

- Real, working: Rust kernel and 5-run SHA-256 determinism gate; L3 CLOB (LIMIT, MARKET, POST_ONLY, IOC, Cancel-Newest STP); revm x·y=k pool (30 bps fee); Markov-Hawkes regimes; ACS scoring; PyO3 SDK; MCP JSON-RPC server with 7 tools; terminal UI; web workstation with an in-browser JS port of the kernel (FNV-1a digest, not SHA-256).
- `/api/arena` needs the compiled `apex-tui` binary and Python on the server.
- Undecided: hosting, authentication provider, what signed-in users can do.

## Brand Commitments

- Voice: the product speaks ("ApexArena stress-tests AI traders…"), with an explicit credit section: Built by Priyanshu Mishra.
- Primary action on the landing page: enter the live app. GitHub and LinkedIn are secondary.
- Links allowed: GitHub profile and repo (github.com/priyanshu-mishra, Apex-Arena); LinkedIn (URL to be supplied by the user). No email or résumé.

## Evidence on Hand

- Determinism: seed 42 → 5/5 identical SHA-256 (`4ee5fa37…` from `apex-tui --verify-determinism --seed 42 --ticks 300`, a calm start with a flash crash injected at tick 150; the score table's `--scenario flash-crash` run is a different run and hashes to `00fc3c52…`; `0d8f0224…` in the test suite).
- Test suites: Rust determinism suite (3 tests), Python SDK + MCP (4 tests).
- Screenshots of the current app in `docs/screenshots/`.
- Absent, must not be fabricated: users, customers, testimonials, live-trading results, performance comparisons against other benchmarks, press.

## Product Principles

1. Approachable first, rigorous on demand: every concept has a plain-English layer and a precise layer.
2. Prove, don't claim: show the mechanism working and let visitors verify it.
3. One core message before any detail: AI traders should be tested by a market that reacts.
4. Honest about scope: label simulated data and the browser port; never overclaim.
