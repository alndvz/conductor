# Tasks

- [x] Test conductor-plugin plugin
- [x] Verify file change detection
- [x] Confirm TICK messages arrive
- [x] Test file change notification with conductor
- [x] Route all messages through sendOrQueue
- [x] Include diff in file change notifications
- [x] Extract pure functions from conductor-plugin.ts: pull out message queueing logic (shouldQueue, enqueue, dequeue), session state transitions (addSession, removeSession, setStatus), notification formatting, and git helpers (gitHash, gitDiff) into separate testable modules. Keep the plugin as a thin orchestrator wiring them together.
- [x] Consolidate git-helpers.ts, message-queue.ts, notifications.ts, and session-state.ts back into conductor-plugin.ts. Keep the functions modular and well-organized within the file, but delete the four separate modules. Update imports accordingly.
- [x] Create an `/install-conductor` command at `.opencode/commands/install-conductor.md` that installs the conductor workflow into a target repo. The command receives `$ARGUMENTS` as the target directory path. The agent should read the necessary files from the current (source) repo and copy/adapt them into the target: copy `conductor-plugin.ts` to `.opencode/plugins/`, copy the four agent definitions to `.opencode/agents/`, merge the `agent` section into the target's `.opencode/opencode.json` (don't blindly overwrite), scaffold `TASKS.md` if missing, copy `conductor.sh` and make it executable, and run `npm install` for `@opencode-ai/plugin` and `@opencode-ai/sdk`. Create directories as needed and report each action taken.
- [x] Add `"permission": "allow"` to the conductor, feature, implementor, and review agent configs in `.opencode/opencode.json` so the conductor workflow runs without permission prompts. Scope to these four agents only (not global), so built-in agents retain their defaults.
- [x] Remove `"permission": "allow"` from the feature, implementor, and review agent configs in `.opencode/opencode.json` — keep it only on the conductor.
