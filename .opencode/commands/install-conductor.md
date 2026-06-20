---
description: Install the conductor workflow into a target repository
---

Your task is to install the Conductor workflow into a target repository. This
copies the agent definitions, plugin, config, launcher script, and task file
from the _source_ repository (where you are running) into the _target_
repository.

## Arguments

`$ARGUMENTS` is the path to the target repo directory. It must be an absolute
path or a path relative to the current working directory.

- If `$ARGUMENTS` is empty or missing, ask the user to provide a target
  directory path before proceeding.

## Source files

Read these files from the **current** (source) repository before copying:

1. `conductor-plugin.ts` — the Conductor plugin (TypeScript)
2. `.opencode/agents/conductor.md` — Conductor agent definition
3. `.opencode/agents/implementor.md` — Implementor agent definition
4. `.opencode/agents/review.md` — Reviewer agent definition
5. `.opencode/agents/feature.md` — Feature agent definition
6. `.opencode/agents/rules-review.md` — Rules-review agent definition
7. `.opencode/opencode.json` — source config (contains the `agent` section to
   merge)
8. `conductor.sh` — launcher script

## Step 1 — Validate and create target directories

Check that `$ARGUMENTS` is a real directory. If it does not exist, create it
with `mkdir -p`.

Then ensure the following directories exist in the target (create them if
missing):

| Directory                        | Purpose                     |
| -------------------------------- | --------------------------- |
| `$ARGUMENTS/.opencode/plugins/`  | Auto-discovered plugins     |
| `$ARGUMENTS/.opencode/agents/`   | Agent definition files      |

## Step 2 — Copy the plugin

Copy `conductor-plugin.ts` from the source repo into
`$ARGUMENTS/.opencode/plugins/conductor-plugin.ts`.

> **Note**: Plugins in `.opencode/plugins/` are auto-discovered by opencode; no
> config entry is needed.

## Step 3 — Copy agent definitions

Copy these five files verbatim (no modifications needed) from the source's
`.opencode/agents/` into `$ARGUMENTS/.opencode/agents/`:

- `conductor.md`
- `implementor.md`
- `review.md`
- `feature.md`
- `rules-review.md`

## Step 4 — Merge the config

Check whether `$ARGUMENTS/.opencode/opencode.json` exists:

### If it exists

1. Read the target config file.
2. Merge the `agent` section from the source config into it. For each agent key
   in the source (`conductor`, `implementor`, `review`, `feature`,
   `rules-review`):
   - If the target already has that agent key, **skip it** (do not overwrite).
   - If the target does not have that agent key, add it.
3. Write the merged config back — preserve all existing top-level keys, the
   `$schema` field, and the ordering as much as practical.
4. Report which agents were added and which were skipped (already present).
5. Check the `default_agent` field in the target config:
   - If it is not set, add `"default_agent": "conductor"`.
   - If it is already set to a value other than `"conductor"`, do not change
     it, but note this in the report and advise the user that the existing
     `default_agent` will remain unchanged.

### If it does not exist

1. Create `$ARGUMENTS/.opencode/opencode.json` by copying the full source
   config. If the source has an empty `plugin` array (`"plugin": []`),
   you may omit it — it is harmless to keep or remove.
2. Ensure the `$schema` field is present:
   `"$schema": "https://opencode.ai/config.json"`.
3. Ensure `"default_agent": "conductor"` is set in the config.

## Step 5 — Scaffold TASKS.md

Check whether `$ARGUMENTS/TASKS.md` exists:

- If it exists, do nothing — the target already has a task list.
- If it does not exist, create it with this content:

  ```markdown
  # Tasks

  <!-- Add tasks below using `- [ ] <description>`. The Conductor agent
       will detect new tasks automatically. -->

  ```

Report whether the file was created or already existed.

## Step 6 — Copy and chmod the launcher

1. Copy `conductor.sh` from the source to `$ARGUMENTS/conductor.sh`.
2. Make it executable: `chmod +x $ARGUMENTS/conductor.sh`.

## Step 7 — Install npm dependencies

In the target directory (`$ARGUMENTS`), check whether a `package.json` exists:

- If it exists, run `npm install` to ensure the required packages
  (`@opencode-ai/plugin` and `@opencode-ai/sdk`) are present. If they are
  missing from `package.json`, run
   `npm install @opencode-ai/plugin@^1.17.7 @opencode-ai/sdk@^1.17.7`.
- If `package.json` does not exist, create one with the required dependencies
  and then run `npm install`. A minimal `package.json`:

  ```json
  {
    "name": "conductor-target",
    "private": true,
    "dependencies": {
      "@opencode-ai/plugin": "^1.17.7",
      "@opencode-ai/sdk": "^1.17.7"
    }
  }
  ```

## Step 8 — Report

Summarize every action taken. Use a table for clarity:

| Action                        | Status                    |
| ----------------------------- | ------------------------- |
| Created target directories    | created / already-existed |
| Copied conductor-plugin.ts    | done                     |
| Copied agent definitions (5)  | done                     |
| Merged config: conductor      | added / skipped          |
| Merged config: implementor    | added / skipped          |
| Merged config: review         | added / skipped          |
| Merged config: feature        | added / skipped          |
| Merged config: rules-review   | added / skipped          |
| Set default_agent: conductor  | set / already-set / kept-existing: <other> |
| Scaffolded TASKS.md           | created / already-existed |
| Copied conductor.sh + chmod   | done                     |
| Installed npm dependencies    | done                     |
