# JCLDB002 Sample Extractor Output

This folder contains a canonical CSV bundle for `JCLDB002`, derived from.

Expected generated layout from the agent:

- `importar/`
  - canonical CSV bundle for Marquito import
- `openlineage/`
  - OpenLineage CSVs
  - `openlineage.jsonl`

Source artifacts used in this sample:

- `JCL/JCLDB002.jcl`
- `programas/CBLDB002A.cbl`
- `programas/CBLDB002B.cbl`
- `copybooks/CPYOUT01.cpy`
- `copybooks/CPYDB201.cpy`
- `copybooks/CPYIN003.cpy`
- `copybooks/CPYDB202.cpy`

The flow reads the output of `JCLDB001`, derives a new intermediate layout in `STEP010`,
then cross-checks it against `APP.INPUT3.COMPLEMENTO` in `STEP020` to produce the final file.

Transformation taxonomy in this sample is standardized as:

- `pass_through`
- `reorder_only`
- `lookup_fetch`
- `lookup_key`
- `arithmetic_compute`
- `conditional_assignment`
- `constant_assignment`

