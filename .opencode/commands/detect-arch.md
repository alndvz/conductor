---
description: Detect and document the architecture of a system or feature
---

Your task is to analyze the architecture of a codebase concept and ensure the
docs at `docs/arch/` faithfully reflect the current code.

## Workflow

### 1. Concept

`$ARGUMENTS` is the concept to analyze. Use it as the starting point.

- If empty or unclear, ask the user what system/feature/module they want you to analyze.
- If the concept is vague (e.g. "the session stuff"), ask which specific
  subsystem they mean before proceeding.

### 2. Preliminary scan

Explore the codebase lightly to identify the candidate files and directories
(namespaces) relevant to this concept. List them out before proceeding further.

### 3. Search existing docs

For each candidate namespace, search `docs/arch/*.md` for existing documents
whose `sources` frontmatter includes that namespace. Use grep to find matches
across all docs.

### 4. Read and decide

Read every matching doc. Based on their current scope:

- If one doc already covers these namespaces → update that doc.
- If multiple docs cover sub-sets → decide whether to merge them into one,
  create a new cross-cutting doc that links to each, or split further.
- If no doc covers these namespaces → create a new doc at `docs/arch/<slug>.md`
  where `<slug>` is the concept name in kebab-case.
- **Explain your decision to the user before proceeding** (which docs will be
  created, which will be updated, which will be removed).

### 5. Full analysis

Dive deep into every relevant file. Understand:

- Entry points, public APIs, and exports
- Internal module structure and organization
- Data flow, control flow, and dependencies between components
- Coupling and cohesion patterns
- Key types, interfaces, classes, and functions
- Design invariants and constraints evident in the code

### 6. Write the doc

Produce the document reflecting **only** the current code:

- If updating an existing doc: **replace it wholesale** with a fresh analysis.
  Do not append. Do not preserve outdated claims as "history."
- Drop any claim or description that no longer holds.
- Create the `docs/arch/` directory if it does not exist.

## Document format

Every architecture doc must use this exact structure:

```markdown
---
sources:
  - path/to/module/
  - path/to/file.ts
concept: Human-Readable Concept Name
---
# Concept Name

## Sources

- `path/to/module/` — role this piece plays in the architecture
- `path/to/file.ts` — ...

## Architecture

<!-- Full analysis of how the pieces fit together, data flow through the
     system, module boundaries, invariants, and design decisions evident
     in the code. Write this for an engineer who needs to understand the
     system without reading every line. -->
```

The `sources` frontmatter must list every namespace (file or directory) this doc
describes. The `Sources` section should briefly describe what each contributes.
The `Architecture` section is the main analysis.
