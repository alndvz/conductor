# Synthwave Showcase Page

## Why

The repo is hard to understand without opening an IDE or chatting with an agent. A self-contained HTML showcase page gives anyone an instant, visually striking overview of what the Conductor Agent is, how it works, and why it's interesting.

## What

A single, self-contained HTML file (`showcase.html`) with a neon synthwave aesthetic that showcases the Conductor Agent repo and all its features. No dependencies, no build step — just open in a browser.

### Aesthetic

- **Dark background** (#0a0a1a / deep navy-black) with CRT scanline overlay
- **Perspective grid floor** — retro-futuristic vanishing-point grid in neon cyan
- **Synthwave sun** — gradient circular sun on the horizon with horizontal slice bars
- **Neon color palette**: cyan (#00ffff), magenta (#ff00ff), hot pink (#ff6b9d), electric purple (#b44dff)
- **Glowing typography** — text-shadow halos on all headings
- **Glassmorphism cards** — semi-transparent panels with backdrop blur and subtle borders
- **Animated on scroll** — sections fade/slide in as they enter the viewport
- **Subtle particle effect** — floating neon particles or starfield in the background
- **80s-inspired decorative elements** — geometric borders, gradient dividers, retro font choices (monospace where appropriate)
- **Responsive** — looks good on desktop and mobile

### Content Sections

1. **Hero** — "CONDUCTOR AGENT" title with massive neon glow, tagline: "Autonomous multi-agent code orchestration", subtle synthwave sun behind it, scroll-down indicator

2. **What Is This?** — Elevator pitch paragraph. It's an OpenCode plugin that watches TASKS.md, delegates to specialized AI sub-agents, reviews their output, and commits — all without human intervention. Think AI project manager + coding team + QA.

3. **Agent Hierarchy** — Visual diagram of the 5 agents:
   - **Conductor** (primary) — orchestrator, arbiter, committer. Model: deepseek-v4-pro. Only agent with `permission: allow` for unattended operation.
   - **Feature** (primary) — conversational-first planner. Discusses with user, writes TASKS.md tasks. Can delegate to explore sub-agent.
   - **Implementor** (sub-agent) — writes code. Read/write/edit/bash/glob/grep. Stateless, fresh context each invocation.
   - **Review** (sub-agent) — general code review. Read-only tools. Returns APPROVED or CHANGES REQUESTED. Model: deepseek-v4-pro.
   - **Rules Review** (sub-agent) — domain rule checker. Evaluates 2 rules (simplicity, minimal-diff) against git diff. Returns PASS/FAIL per rule. Model: deepseek-v4-flash.

   Show data flow: User → Feature → TASKS.md → Conductor → Implementor → (Review + Rules-Review in parallel) → Conductor arbitration → Commit.

4. **How It Works** — Numbered step-by-step flow with visual connectors:
   1. User writes feature request or task
   2. Feature agent discusses, clarifies, captures into TASKS.md and/or conductor-plans/
   3. Plugin polls git hash every 5s, detects TASKS.md change
   4. Plugin notifies Conductor agent with the diff
   5. Conductor reads tasks, delegates to Implementor(s)
   6. For plan-based tasks: fans out parallel implementors, runs sequential steps in order
   7. Implementor writes code, reports completion
   8. Conductor launches Review AND Rules-Review in parallel
   9. Conductor arbitrates any CHANGES REQUESTED: legitimate → send back, nonsensical → push back, cyclical → escalate to user, minor → override and commit
   10. Conductor commits with descriptive message, marks task [x]

5. **Key Features** — Card grid:
   - **Plugin-Based Orchestration** — Your plugin architecture with guard-based activation, session management, and backpressure via message queueing
   - **Plan-Driven Parallelism** — Multi-step plans fan out to parallel implementors, then review in parallel
   - **Dual-Layer Review** — General code review + rules-based review run concurrently
   - **Intelligent Arbitration** — Conductor doesn't blindly follow reviewers; evaluates feedback and pushes back when appropriate
   - **Self-Installing** — `/install-conductor` command bootstraps the whole workflow into any target repo
   - **Containerized Dev** — `dev.sh` builds and runs a Fedora Podman container with full dev environment
   - **Architecture Documentation** — `/detect-arch` command auto-generates architecture docs
   - **File Change Detection** — Git hash polling with diff computation; robust against clock skew

6. **Architecture Deep Dive** — Cards or tabbed content covering:
   - Plugin design: activation gate (`CONDUCTOR=1`), polling loop, session tracking, message queueing with backpressure, defensive idle detection, fire-and-forget messaging, self-contained cleanup
   - Plan execution model: independent steps parallelized, dependent steps sequential, combined diff review
   - Arbitration logic: the 4-way branching (legitimate / nonsensical / cyclical / minor)

7. **Repo Stats** — Animated counters or stat cards:
   - 24 tracked files
   - 60 commits
   - 5 AI agents
   - 2 custom commands (`/install-conductor`, `/detect-arch`)
   - 2 conductor plans executed

8. **Tech Stack** — Badge/tag row:
   - TypeScript 6.0.3
   - OpenCode Plugin SDK 1.17.7
   - Bash (launcher / dev / logs scripts)
   - Podman (containerized dev)
   - Git (change detection)
   - deepseek-v4-pro (primary model)
   - deepseek-v4-flash (rules review)

9. **File Map** — A compact directory tree or expandable list showing the key files and their roles (conductor-plugin.ts, conductor.sh, .opencode/agents/*.md, etc.)

10. **Footer** — "BUILT WITH NEON AND CODE" tagline, link to OpenCode, maybe a tiny animated synthwave sun

## Constraints

- Single file: `showcase.html` in the repo root
- No external dependencies (no CDN fonts, no JS libraries, no images)
- No build step — pure HTML + inline CSS + inline vanilla JS
- Must work in modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive: 320px to 4K
- Dark theme only (synthwave)
- Must not require a web server — works from `file://` protocol
- Scanline effect must be CSS-only (no JavaScript for the visual effect itself)
- Animations should respect `prefers-reduced-motion`
- Content must be factually accurate against the repo

## Acceptance

- Open `showcase.html` in a browser and see a visually striking synthwave page
- All sections present and readable
- Agent hierarchy correctly reflects the 5 agents and their relationships
- Workflow steps are accurate
- Stats match the repo (24 files, 60 commits, etc.)
- No broken styles on mobile viewport (375px)
- No console errors
- Page loads and renders without internet connection
