# Tasks

- [x] Test conductor-plugin plugin
- [x] Verify file change detection
- [x] Confirm TICK messages arrive
- [x] Test file change notification with conductor
- [x] Route all messages through sendOrQueue
- [x] Include diff in file change notifications
- [x] Extract pure functions from conductor-plugin.ts: pull out message queueing logic (shouldQueue, enqueue, dequeue), session state transitions (addSession, removeSession, setStatus), notification formatting, and git helpers (gitHash, gitDiff) into separate testable modules. Keep the plugin as a thin orchestrator wiring them together.
- [ ] Consolidate git-helpers.ts, message-queue.ts, notifications.ts, and session-state.ts back into conductor-plugin.ts. Keep the functions modular and well-organized within the file, but delete the four separate modules. Update imports accordingly.
