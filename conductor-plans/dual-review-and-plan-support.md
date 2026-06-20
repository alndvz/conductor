# Add Plan Support and Parallel Implementation to Conductor and Feature Agents

## Why

TASKS.md is a flat checklist with no room for rationale, constraints, or multi-step plans. We need a way to give the conductor richer context when a task is more than a one-liner. Plans live in `conductor-plans/` and are referenced from TASKS.md entries. Additionally, when a plan has multiple independent steps, the conductor should run them in parallel rather than sequentially.

## What

Three changes:

### 1. Teach the conductor to read plans

Edit `.opencode/agents/conductor.md`:

- In the "When TASKS.md changes" workflow, add a step before delegation: if a task text references `conductor-plans/` (e.g., "see conductor-plans/foo.md"), read that plan file and use it to guide delegation. The plan's "What" section describes the implementation steps.
- Update the "Context management" section: plans in `conductor-plans/` are fair to read when a task references them — this is the one exception to "only read TASKS.md."
- Update the "Only read TASKS.md" rule to mention the plan-reading exception.

### 2. Teach the conductor to run plan steps in parallel

Edit `.opencode/agents/conductor.md`:

- When a plan has multiple implementation steps, launch them as parallel implementor sub-agents in a single message (multiple Task tool calls). Wait for all implementors to complete.
- After all implementors finish, run both reviewers (general + rules-review) on the combined diff once, in parallel.
- The existing "Process one task at a time" rule means one TASKS.md entry at a time — a plan that fans out multiple implementors still counts as one task.

### 3. Teach the feature agent to write plans

Edit `.opencode/agents/feature.md`:

- Add a "Plans" section: when a user request is multi-step or needs rationale/constraints beyond a one-line task, write a plan to `conductor-plans/<name>.md` and add a referencing task to TASKS.md (`- [ ] <summary> — see conductor-plans/<name>.md`).
- Plan template: `# Title`, `## Why`, `## What`, `## Constraints`, `## Acceptance`.
- Plans should be small — 2-5 implementation steps, not dozens. If it's a simple one-liner, skip the plan and write a flat task.
- The `conductor-plans/` directory already exists at the repo root.

## Constraints

- The conductor still processes one TASKS.md entry at a time. A plan task may fan out multiple parallel implementors internally, but all steps (implement + review) complete before the TASKS.md task is marked done.
- When plan steps are independent (no ordering constraints), they should run in parallel. If one step depends on another, they must run sequentially.
- Plans are read-only artifacts. Only the feature agent (or human) writes them.

## Acceptance

- Conductor reads and follows a plan when a task references `conductor-plans/`.
- Conductor runs independent plan steps as parallel implementor invocations.
- Feature agent writes plans for multi-step/nuanced requests and flat tasks for simple ones.
