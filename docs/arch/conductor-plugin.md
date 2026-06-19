---
sources:
  - conductor-plugin.ts
  - .opencode/plugins/
  - .opencode/agents/conductor.md
  - .opencode/opencode.json
  - conductor.md
  - conductor.sh
concept: Conductor Plugin
---
# Conductor Plugin

## Sources

- `conductor-plugin.ts` — the plugin implementation; single-file module (~214 lines) exported as `ConductorPlugin`
- `.opencode/plugins/conductor-plugin.ts` — symlink to `conductor-plugin.ts`; consumed by opencode at runtime
- `.opencode/agents/conductor.md` — agent definition (mode: primary, model: `opencode-go/deepseek-v4-pro`)
- `.opencode/opencode.json` — per-project opencode config; declares the `conductor` agent and its enabled tools
- `conductor.md` — duplicate of the agent definition at the workspace root
- `conductor.sh` — launcher script; sets `CONDUCTOR=1` and invokes `opencode --agent conductor`

## Architecture

The conductor plugin is an opencode plugin that monitors `TASKS.md` for git changes and notifies all active sessions. It is the central nervous system of the conductor workflow: watching for changes, tracking session state, and routing messages with backpressure.

### Activation gate

The plugin is a no-op unless the `CONDUCTOR` environment variable is set (`conductor-plugin.ts:15`). When absent, it returns empty `event` and `dispose` hooks. This is the primary safety mechanism — the plugin cannot activate accidentally in non-conductor contexts.

### Entry point and lifecycle

The sole export is `ConductorPlugin: Plugin`, a factory function that receives the opencode plugin context (`{ client, directory, worktree, $ }`). It returns two hooks:

- **`event`** — processes every session event the runtime delivers
- **`dispose`** — clears all intervals, maps, and sets when the plugin is unloaded

### Internal state (all heap-allocated, non-exported closures)

| Variable | Type | Purpose |
|---|---|---|
| `activeSessions` | `Set<string>` | Tracks all known session IDs |
| `tickIntervals` | `Map<string, IntervalHandle>` | Per-session heartbeat intervals (10s) |
| `fileHashes` | `Map<string, string>` | Git commit hashes of watched files |
| `sessionStatus` | `Map<string, "idle" \| "busy" \| "retry">` | Per-session busy/idle state |
| `pendingMessages` | `Map<string, { text; noReply }[]>` | Queued messages for busy sessions |

### Watched files and polling loop

A single `setInterval` fires every **5 seconds** (`conductor-plugin.ts:143`). Each tick:

1. Iterates `WATCH_FILES` (currently `["TASKS.md"]`, line 3)
2. Runs `git log -1 --format=%H -- <file>` to get the latest commit hash for that file
3. If the hash differs from a cached previous hash, runs `git diff <prev>..<curr> -- <file>`
4. Calls `notifyAllSessions()` with the diff, formatted as a markdown code block
5. Updates the hash cache

Files that don't exist in the repo (empty hash) are skipped — they never trigger notifications.

### Session tracking and lifecycle

Five session events drive state transitions:

- **`session.created`** — session ID added to `activeSessions`; heartbeat tick started; conductor ASCII-art banner sent via `sendOrQueue` (with `noReply: true`)
- **`session.next.agent.switched`** — logged; a notification sent to the session (non-blocking)
- **`session.status`** — status recorded in `sessionStatus`; if `idle`, drains pending messages
- **`session.idle`** — status set to `idle`; drains pending messages
- **`session.deleted`** — session removed from all maps and sets; tick stopped; pending messages discarded

Both `session.status` and `session.idle` trigger the same idle-drain behavior, which is a defensive pattern — the plugin treats either event as a signal that the session can receive messages.

### Message routing with backpressure (`sendOrQueue`)

All outbound messages route through `sendOrQueue` (`conductor-plugin.ts:64`). This is the plugin's backpressure mechanism:

- If the session is **idle** (or no status yet recorded) → send immediately via `client.session.prompt()`
- If the session is **busy** or **retry** → push to `pendingMessages` queue

Messages are sent with `agent: "conductor"` and fire-and-forget (`.catch(() => {})`). No retry logic exists at the send level — if a send fails, the message is silently dropped.

**Draining** (`drainPending`, line 48): when a session transitions to idle, all queued messages are dequeued and sent in FIFO order. The queue is cleared before sending to prevent re-queuing if drain itself triggers another status change.

### Heartbeat ticks

Each session gets a 10-second heartbeat interval (`startTick` at line 95). These only produce log entries — no user-facing messages. They serve as a liveness signal visible in the opencode log file. Ticks are stopped when the session is deleted.

### Logging

Every state transition and operation produces a log entry via `client.app.log()` at `info` level, tagged with `service: "conductor-plugin"`. Messages use a consistent `### CONDUCTOR-PLUGIN <ACTION> | key=value ###` format. This is purely for debugging — no structured logging or telemetry.

### Design invariants

1. **No message loss while busy.** Messages are queued, not dropped, when a session is busy.
2. **One notification per change.** File hash comparison prevents duplicate notifications for the same git state.
3. **Self-contained cleanup.** `dispose()` clears every interval, set, and map — no state leaks on unload.
4. **Graceful degradation.** All async operations use `.catch(() => {})` — failures are swallowed. The plugin never crashes the host.
5. **No cross-session logic.** Sessions are independent; state is never shared between them.

### Dependencies

- **`@opencode-ai/plugin`** — provides the `Plugin` type and plugin contract
- **`@opencode-ai/sdk`** — consumed indirectly through `client.session.prompt()`, `client.app.log()`, and `client.event.*`
- **Runtime:** `opencode` CLI, `git`, bash
