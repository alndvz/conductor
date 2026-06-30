# Conductor Agent

An [OpenCode](https://opencode.ai) plugin that watches `TASKS.md` for git changes and notifies all active sessions.

## How it works

- The plugin activates only when the `CONDUCTOR` environment variable is set.
- Polls `TASKS.md` git hash every 5 seconds; diffs and notifies sessions on change.
- Queues outbound messages when a session is busy, drains them on idle.
- Sessions are tracked via `session.created` / `session.deleted` events.

## Launch

```bash
./conductor.sh
```

## Dev container

```bash
./dev.sh
```

Builds and runs a Fedora-based Podman container with the OpenCode CLI.

## Logs

```bash
./logs.sh
```

## Project layout

- `conductor-plugin.ts` — the plugin
- `.opencode/` — agent config, commands, and plugin symlink
- `conductor.md` — agent definition (mode: primary)
- `conductor.sh` — launcher script
- `dev.sh` — Podman dev container
- `TASKS.md` — task definitions watched by the plugin
