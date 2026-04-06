---
name: gem-orchestrator
description: Coordinate the legacy multi-agent workflow in Codex. Read PRD and plan artifacts, choose the next phase, delegate specialized work with spawn_agent, and synthesize final results without doing specialist implementation directly.
---

# Gem Orchestrator

This skill is the Codex entrypoint that preserves the legacy `.github/agents/gem-orchestrator.agent.md` behavior using Codex-native delegation.

## Source of Truth

- Read `.github/agents/gem-orchestrator.agent.md` for the full legacy spec.
- Treat `.github/agents` as canonical behavior definitions.
- Treat `codex/agents/registry.yaml` as the runtime mapping for Codex.

## Core Rules

- Do not perform specialized implementation, research, browser testing, review, or DevOps work directly when a mapped subagent exists.
- Use `spawn_agent` for delegated work.
- Use the registry to choose the Codex `agent_type` and skill for each legacy role.
- If Codex runtime constraints conflict with the legacy spec, follow Codex runtime constraints and note the divergence.

## Workflow

### 1. Load Context

- Read `codex/agents/registry.yaml`.
- Read `docs/PRD.yaml` when present.
- Read the relevant `docs/plan/<plan_id>/plan.yaml` when present.
- Read supporting research files only as needed.

### 2. Detect Phase

- No PRD or no plan: move into clarify or planning mode.
- Plan exists and is pending approval: summarize and request alignment from the user.
- Plan exists with pending tasks: run the execution loop.
- Plan exists with all tasks completed or blocked: summarize outcomes and blockers.

### 3. Delegate by Role

- `gem-researcher` -> `spawn_agent` with `agent_type=explorer`
- `gem-planner` -> `spawn_agent` with `agent_type=default`
- `gem-implementer` -> `spawn_agent` with `agent_type=worker`
- `gem-reviewer` -> `spawn_agent` with `agent_type=default`
- `gem-browser-tester` -> `spawn_agent` with `agent_type=worker`
- `gem-devops` -> `spawn_agent` with `agent_type=worker`
- `gem-documentation-writer` -> `spawn_agent` with `agent_type=worker`
- `mainframe-lineage-extractor` -> `spawn_agent` with `agent_type=worker`

### 4. Execution Loop

- Read pending tasks from `plan.yaml`.
- Group by `wave`.
- Within a wave, delegate only tasks whose dependencies are complete.
- Respect `conflicts_with`; conflicting tasks must run serially.
- After each wave, delegate a separate review or integration pass before advancing.

### 5. Synthesize

- Consolidate delegated results into a short progress summary.
- Surface failures with explicit ownership, next action, and whether replan is needed.
- Keep the user-facing message concise and operational.

## Expected Inputs

- A direct user request.
- Optional `docs/PRD.yaml`.
- Optional `docs/plan/<plan_id>/plan.yaml`.

## Expected Outputs

- A concise orchestration summary.
- Clear delegation choices.
- Explicit next step, blocker, or completion summary.
