# JCLDB001 Sample Extractor Output

This folder contains a sample canonical CSV bundle plus OpenLineage CSVs and `openlineage.jsonl` derived from.

Expected generated layout from the agent:

- `importar/`
  - canonical CSV bundle for Marquito import
- `openlineage/`
  - OpenLineage CSVs
  - `openlineage.jsonl`

Source artifacts used in this sample:

- `JCL/JCLDB001.jcl`
- `programas/CBLDB001.cbl`
- `copybooks/CPYIN001.cpy`
- `copybooks/CPYIN002.cpy`
- `copybooks/CPYOUT01.cpy`
- `dclgen/DCLTB001.dcl`

The extraction follows a program-first strategy and then reconciles physical datasets and step ordering with the JCL.

Transformation taxonomy in this sample is standardized as:

- `copia_identidade`
- `reordenacao_registro`
- `copia_enriquecimento_registro`
- `busca_valor`
- `uso_chave_busca`
- `calculo_derivado`
- `derivacao_condicional`
- `constante_condicional`
- `constante_literal`
- `nao_classificada`

`rule_type` keeps the raw technical family such as `move`, `copy`, `sort`, `db_lookup`, `compute`, `conditional`, and `constant`, while `rule_subtype` carries the normalized semantic category.
