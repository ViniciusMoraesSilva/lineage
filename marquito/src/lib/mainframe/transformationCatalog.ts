export interface MainframeTransformationSpec {
  key: string;
  label: string;
  description: string;
  origin: string;
}

const TRANSFORMATION_SPECS: Record<string, MainframeTransformationSpec> = {
  pass_through: {
    key: 'pass_through',
    label: 'Pass-through / copia direta',
    description: 'Replica o valor de entrada sem alterar a semantica do campo.',
    origin: 'JCL COPY ou COBOL MOVE',
  },
  reorder_only: {
    key: 'reorder_only',
    label: 'Reordenacao sem alteracao',
    description: 'Reordena registros preservando o valor logico dos campos.',
    origin: 'SORT no JCL',
  },
  lookup_fetch: {
    key: 'lookup_fetch',
    label: 'Lookup DB2',
    description: 'Busca valor externo em tabela DB2 e propaga para a saida.',
    origin: 'Programa COBOL + SQL + DCLGEN',
  },
  lookup_key: {
    key: 'lookup_key',
    label: 'Chave de lookup DB2',
    description: 'Campo usado para localizar registro externo, nao para popular diretamente a saida.',
    origin: 'Programa COBOL + SQL + DCLGEN',
  },
  arithmetic_compute: {
    key: 'arithmetic_compute',
    label: 'Calculo aritmetico',
    description: 'Campo derivado por operacao matematica.',
    origin: 'Programa COBOL',
  },
  conditional_assignment: {
    key: 'conditional_assignment',
    label: 'Atribuicao condicional',
    description: 'Campo derivado por IF/ELSE, EVALUATE ou regra de decisao.',
    origin: 'Programa COBOL',
  },
  constant_assignment: {
    key: 'constant_assignment',
    label: 'Constante / hard code',
    description: 'Campo preenchido por literal fixo, independente de fonte upstream.',
    origin: 'JCL ou Programa COBOL',
  },
  unknown: {
    key: 'unknown',
    label: 'Transformacao nao classificada',
    description: 'Ainda nao foi mapeada para a taxonomia padronizada.',
    origin: 'Indefinido',
  },
};

export function normalizeMainframeTransformation(
  ruleType?: string,
  ruleSubtype?: string,
): MainframeTransformationSpec {
  const type = String(ruleType || '').toLowerCase();
  const subtype = String(ruleSubtype || '').toLowerCase();

  if (subtype && TRANSFORMATION_SPECS[subtype]) {
    return TRANSFORMATION_SPECS[subtype];
  }

  if (
    (type === 'copy' && subtype === 'identity') ||
    (type === 'move' && subtype === 'direct') ||
    (type === 'copy' && subtype === 'direct')
  ) {
    return TRANSFORMATION_SPECS.pass_through;
  }

  if (type === 'sort' && subtype === 'identity_preserving') {
    return TRANSFORMATION_SPECS.reorder_only;
  }

  if (type === 'sort' && (subtype === 'copy_overlay' || subtype === 'overlay_enrichment')) {
    return TRANSFORMATION_SPECS.pass_through;
  }

  if (type === 'db_lookup' && subtype === 'select_into') {
    return TRANSFORMATION_SPECS.lookup_fetch;
  }

  if (type === 'db_lookup' && subtype === 'join_key') {
    return TRANSFORMATION_SPECS.lookup_key;
  }

  if (type === 'compute') {
    return TRANSFORMATION_SPECS.arithmetic_compute;
  }

  if (type === 'conditional' && subtype === 'if_else') {
    return TRANSFORMATION_SPECS.conditional_assignment;
  }

  if (type === 'constant' || subtype === 'literal') {
    return TRANSFORMATION_SPECS.constant_assignment;
  }

  return TRANSFORMATION_SPECS.unknown;
}

export function formatRawTransformation(ruleType?: string, ruleSubtype?: string): string {
  const type = String(ruleType || 'unknown').toLowerCase();
  const subtype = String(ruleSubtype || 'unknown').toLowerCase();
  return `${type}/${subtype}`;
}
