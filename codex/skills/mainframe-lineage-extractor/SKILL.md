---
name: mainframe-lineage-extractor
description: Analyze COBOL and JCL artifacts to produce canonical lineage CSV bundles and OpenLineage JSONL output with traceable evidence.
---

# Mainframe Lineage Extractor

Codex-native translation of `.github/agents/mainframe-lineage-extractor.agent.md`.

## Core Rules

- Start from the main program before the JCL.
- Resolve `COPY` and DCLGEN dependencies before reconciling runtime datasets.
- Preserve evidence and confidence for important lineage links.

## Workflow

### 1. Program Analysis

- Read the main COBOL program.
- Resolve copybooks, DCLGENs, SQL, file assignments, and writes.

### 2. Lineage Derivation

- Build field-level lineage from program logic.
- Reconcile logical files with JCL DD names and datasets after program semantics are understood.

### 3. Emit Artifacts

- Canonical CSV bundle
- OpenLineage intermediary CSVs
- `openlineage.jsonl`
- `evidence.csv`
