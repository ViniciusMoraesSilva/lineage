# JCLDB001 Sample Extractor Output

This folder contains a sample canonical CSV bundle plus OpenLineage CSVs and `openlineage.jsonl` derived from:

- `JCL/JCLDB001.jcl`
- `programas/CBLDB001.cbl`
- `copybooks/CPYIN001.cpy`
- `copybooks/CPYIN002.cpy`
- `copybooks/CPYOUT01.cpy`
- `dclgen/DCLTB001.dcl`

The extraction follows a program-first strategy and then reconciles physical datasets and step ordering with the JCL.

Transformation taxonomy in this sample is standardized as:

- `pass_through`
- `reorder_only`
- `lookup_fetch`
- `lookup_key`
- `arithmetic_compute`
- `conditional_assignment`
- `constant_assignment`

`rule_type` keeps the raw technical family such as `move`, `copy`, `sort`, `db_lookup`, `compute`, `conditional`, and `constant`, while `rule_subtype` carries the normalized semantic category.
