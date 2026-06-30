# Conductor Agent

A structured, multi-agent workflow for [OpenCode](https://opencode.ai) that turns coding tasks into a disciplined implement → review → merge pipeline.

## Why use this?

OpenCode is powerful, but a single agent doing everything gets sloppy — it skips tests, misses edge cases, and introduces bugs that a fresh pair of eyes would catch. The Conductor enforces a **separation of concerns**:

- **Conductor** — orchestrates, delegates, arbitrates. It never touches code.
- **Implementor** — writes the code. Has full write tools, no distractions.
- **Review** — code review. Read-only, focused on correctness and style.
- **Rules-review** — domain-specific rule checking. Run in parallel with Review.

Every task flows through **implement → dual review → commit**. Reviews can block, request changes, or be overridden (with the conductor acting as arbitrator). The result: higher quality code, fewer regressions, and no more "the agent just did something weird."

Tasks are defined in a single file (`TASKS.md`). The conductor plugin watches it for git changes and notifies all active sessions — so you can add tasks from another terminal and the conductor picks them up automatically.

## Quick start

```bash
npm install
./conductor.sh
```

That's it. The conductor launches, reads `TASKS.md`, and begins processing incomplete tasks.

## How it works

```
  you (edit TASKS.md)
        │
        ▼
  conductor-plugin ─── watches for git changes every 5s
        │
        ▼
  conductor.md ────── reads TASKS.md, delegates tasks
        │
        ├── implementor ── writes code
        │
        ├── review ─────── code review (style, correctness)
        └── rules-review ── domain rule check (parallel)
              │
              ▼
        both APPROVED?
         ├─ yes → commit, mark task done
         └─ no  → feed back to implementor (or override)
```

## Agents

| Agent | Role | Tools |
|---|---|---|
| **conductor** | Orchestrates, delegates, arbitrates reviews | Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch |
| **feature** | Discusses feature requests conversationally before committing to TASKS.md | Task, Bash, Read, Write, Edit, Glob, Grep |
| **implementor** | Writes and edits code | Bash, Read, Write, Edit, Glob, Grep, WebFetch |
| **review** | General code review (style, correctness) | Bash, Read, Glob, Grep |
| **rules-review** | Checks 2 rules: simplicity and minimal-diff | Bash, Read, Glob, Grep |

## Plugin

`conductor-plugin.ts` activates only when `CONDUCTOR=1` is set. It:

- Polls `TASKS.md` git hash every 5 seconds; diffs and notifies sessions on change
- Queues messages when a session is busy, drains them on idle
- Tracks sessions via `session.created` / `session.deleted` events
- Sends agent-switch notifications to keep you oriented

## Adding tasks

Edit `TASKS.md` — commit your changes:
```bash
git add TASKS.md && git commit -m "add thing" TASKS.md
```

The conductor detects the commit and picks up new `- [ ]` items automatically.

For multi-step tasks, create a plan in `conductor-plans/` and reference it:
```markdown
- [ ] Build auth system — see conductor-plans/auth.md
```

## Install into another repo

```bash
opencode --command install-conductor /path/to/target/repo
```

Copies the plugin, agents, and config. Merges into existing `opencode.json`. Scaffolds `TASKS.md` if missing.

## Dev container

```bash
./dev.sh
```

Builds and runs a Fedora-based Podman container with OpenCode pre-installed.

## Logs

```bash
./logs.sh
```

Tails the OpenCode log file.

## Project layout

```
conductor-plugin.ts          # the plugin (symlinked at .opencode/plugins/)
conductor.md                 # agent definition (mode: primary)
conductor.sh                 # launcher — sets CONDUCTOR=1, runs opencode --agent conductor
dev.sh                       # Podman dev container
logs.sh                      # tail the opencode log
TASKS.md                     # task definitions (watched by the plugin)
conductor-plans/             # multi-step plan files
.opencode/
  opencode.json              # agent config (tools, models, permissions)
  agents/
    conductor.md             # conductor agent instructions
    feature.md               # feature discussion agent instructions
    implementor.md           # implementor sub-agent instructions
    review.md                # general review sub-agent instructions
    rules-review.md          # domain rules review sub-agent instructions
  commands/
    install-conductor.md     # install command definition
    detect-arch.md           # architecture analysis command
  plugins/
    conductor-plugin.ts      # → symlink to ../conductor-plugin.ts
```
