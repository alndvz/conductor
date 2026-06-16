# Conductor Agent

An OpenCode plugin project. The plugin (`conductor-plugin.ts`) watches `TASKS.md` for git changes and notifies all active sessions.

## Project layout

- `conductor-plugin.ts` — the plugin (symlinked at `.opencode/plugins/conductor-plugin.ts`)
- `.opencode/agents/conductor.md` / `conductor.md` — agent definition (mode: primary)
- `.opencode/opencode.json` — agent config (tools enabled, model)
- `.opencode/commands/detect-arch.md` — custom command for architecture analysis
- `conductor.sh` — launcher script; sets `CONDUCTOR=1` and runs `opencode --agent conductor`
- `dev.sh` — builds and runs a Podman container (Fedora, `conductor-agent-dev:latest`)
- `logs.sh` — tails the opencode log file

## Key behaviors

- The plugin activates **only when `CONDUCTOR` env var is set** (otherwise returns no-ops)
- Polls `TASKS.md` git hash every 5 seconds; diffs and notifies all sessions on change
- Queues outbound messages when a session is busy, drains them on idle
- Sessions are tracked by the `session.created` / `session.deleted` events
- `conductor.sh` is the canonical way to launch

## Dependencies

- Runtime: `@opencode-ai/plugin@1.17.7`, `@opencode-ai/sdk@1.17.7`
- Dev: `typescript@^6.0.3`
- The `opencode` CLI must be installed globally (or run via the container)

## opencode/ directory

A full checkout of `opencode-ai/opencode` for reference. It is **gitignored** and not part of this project. Its own `AGENTS.md` and `CONTEXT.md` document the upstream coding conventions and session runtime concepts.

## There are no build/test/lint scripts

This is a demo/skeleton project. `package.json` scripts are stubs. No CI/CD, no typecheck, no formatter configured at this level.
