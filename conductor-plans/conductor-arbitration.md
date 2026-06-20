# Add Arbitration Logic to the Conductor Agent

## Why

The conductor currently runs a blind implement → review → fix → re-review loop. When a review returns CHANGES REQUESTED, the conductor forwards the feedback to the implementor unconditionally, repeating until both reviews pass. This breaks down when:

- A reviewer misunderstands the task and flags something correct as wrong.
- A rule (e.g., "no reformatting") is mechanically applied where it makes no sense.
- The same feedback cycles back after the implementor already addressed it.
- The reviewer's concern is technically valid but inconsequential (cosmetic, subjective, or out of scope).

The conductor needs to act as an **arbitrator** — evaluating review feedback before forwarding it, pushing back on nonsense, escalating ambiguous disputes, and overriding minor issues.

## What

Edit `.opencode/agents/conductor.md`. Three changes:

### 1. Replace step 7 (blind forwarding loop) with arbitration-aware logic

Replace:

> 7. If EITHER review returns **CHANGES REQUESTED**, send the feedback back to the implementor for fixes, then re-review with both agents. Repeat until both approve.

With numbered sub-steps that branch on feedback quality:

- **Legitimate feedback** — the issue is real, actionable, and within scope. Forward to the implementor for fixes, then re-review. Repeat until both approve.
- **Nonsensical or contradictory feedback** — the review misunderstands the task, contradicts the task description, or misapplies a rule. Push back on the reviewer with a clarifying question. If the reviewer doubles down on something clearly wrong, proceed past the review.
- **Cyclical feedback** — the same issue returns after the implementor already addressed it, or after 2+ rounds of unchanged complaint. Escalate to the user with a summary. If the user doesn't respond and the matter is minor, override and proceed.
- **Minor issue** — the reviewer's concern is technically valid but inconsequential (cosmetic, subjective, or outside the task's scope). Override and proceed. Note the override in the commit message: `implement: <summary> (review overridden: <reason>)`.

### 2. Replace the "Never skip review" rule

Replace:

> - Always run through the full implement → review & rules-review cycle. Never skip review.

With a qualified version:

> - Run through the full implement → review & rules-review cycle. You may override a review only when the feedback is nonsensical, cyclical, or concerns a minor issue. When in doubt, escalate to the user.

### 3. Add an `## Arbitration` section

Insert between `## Rules` and `## Context management`. Document:

- The conductor's role as arbitrator (evaluate every CHANGES REQUESTED verdict, push back on reviewers, override when appropriate).
- The escalation trigger and format: a concise summary of the task, the reviewer's objection, the implementor's response, why it's stuck, and "Proceed or override?".

## Constraints

- Appeals to review feedback must cite specific contradictions (e.g., "the reviewer flagged X, but the task only asks for Y").
- Override commit messages must include `(review overridden: <reason>)`.
- Escalation should be brief — a few lines, not paragraphs. The user should grasp the dispute at a glance.

## Acceptance

- Conductor evaluates CHANGES REQUESTED feedback instead of blindly forwarding.
- Nonsensical or cyclical feedback triggers pushback or escalation, not another loop cycle.
- Minor issues can be overridden with a noted commit message.
- Escalation presents a clear summary with "Proceed or override?" prompt.
