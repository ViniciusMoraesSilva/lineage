# Codex Agents Bridge

Este repositório mantém os agentes legados em [`.github/agents`](/Users/macbookpro/Documents/git/mainframelineage/.github/agents) como fonte de comportamento e adiciona uma camada compatível com o runtime real do Codex.

## O que foi criado

- [`codex/agents/registry.yaml`](/Users/macbookpro/Documents/git/mainframelineage/codex/agents/registry.yaml): mapeamento `legacy agent -> Codex agent_type + skill`
- [`codex/skills`](/Users/macbookpro/Documents/git/mainframelineage/codex/skills): skills repo-owned que traduzem a intenção dos `.agent.md`
- [`scripts/codex/install-skills.sh`](/Users/macbookpro/Documents/git/mainframelineage/scripts/codex/install-skills.sh): instala as skills em `~/.codex/skills`
- [`scripts/codex/validate-codex-agents.mjs`](/Users/macbookpro/Documents/git/mainframelineage/scripts/codex/validate-codex-agents.mjs): valida registry + skills + cobertura dos agentes legados
- [`scripts/codex/simulate-orchestrator.mjs`](/Users/macbookpro/Documents/git/mainframelineage/scripts/codex/simulate-orchestrator.mjs): dry run do orquestrador lendo PRD e `plan.yaml`

## Como invocar

O ponto de entrada recomendado é `gem-orchestrator`.

Exemplos de prompts:

```text
Use o skill gem-orchestrator para ler docs/PRD.yaml e docs/plan/column-lineage-viewer-20240405/plan.yaml e me dizer a próxima wave.
```

```text
Use o skill gem-orchestrator e siga o registry em codex/agents/registry.yaml para delegar as tasks pendentes do plan.yaml.
```

```text
Use o skill gem-orchestrator para revisar o plano, identificar tasks prontas e chamar os subagents corretos.
```

## Mapeamento de runtime

- `gem-orchestrator` -> `default`
- `gem-researcher` -> `explorer`
- `gem-planner` -> `default`
- `gem-implementer` -> `worker`
- `gem-reviewer` -> `default`
- `gem-browser-tester` -> `worker`
- `gem-devops` -> `worker`
- `gem-documentation-writer` -> `worker`
- `mainframe-lineage-extractor` -> `worker`

## Como o orquestrador escolhe subagents

- Lê `docs/PRD.yaml` e o `docs/plan/<plan_id>/plan.yaml`
- Descobre a fase atual do fluxo
- Seleciona tasks `pending` cuja dependência já foi satisfeita
- Agrupa por `wave`
- Respeita `conflicts_with`
- Mapeia `task.agent` usando o registry
- Faz gate de revisão separado antes de avançar para a próxima wave

## Limites da compatibilidade

Esta camada não executa os `.agent.md` diretamente. Ela preserva a intenção deles.

- `runSubagent` vira `spawn_agent`
- `disable-model-invocation` vira convenção, não regra hardcoded
- `user-invocable` vira recomendação de uso/documentação
- Se houver conflito entre um `.agent.md` e as restrições do runtime do Codex, vale o runtime do Codex

## Instalação

Symlink das skills repo-owned para o Codex:

```bash
./scripts/codex/install-skills.sh
```

Cópia física em vez de symlink:

```bash
./scripts/codex/install-skills.sh --copy
```

Dry run:

```bash
./scripts/codex/install-skills.sh --dry-run
```

## Validação

Validar registry e skills:

```bash
node scripts/codex/validate-codex-agents.mjs
```

Simular o orquestrador lendo o plano atual:

```bash
node scripts/codex/simulate-orchestrator.mjs
```

Se `docs/PRD.yaml` ou `docs/plan/<plan_id>/plan.yaml` não existirem no working tree atual, o script não quebra o bridge; ele reporta a ausência do artefato e orienta como continuar.
