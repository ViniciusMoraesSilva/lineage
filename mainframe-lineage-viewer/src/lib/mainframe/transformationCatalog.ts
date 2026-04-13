export interface MainframeTransformationSpec {
  key: string;
  label: string;
  description: string;
  origin: string;
}

const TRANSFORMATION_SPECS: Record<string, MainframeTransformationSpec> = {
  copia_identidade: {
    key: 'copia_identidade',
    label: 'Copia de identidade',
    description: 'Replica o valor do campo sem alterar a semantica de negocio.',
    origin: 'COBOL MOVE ou copia direta em utilitario/JCL',
  },
  reordenacao_registro: {
    key: 'reordenacao_registro',
    label: 'Reordenacao de registro',
    description: 'Reordena os registros preservando os valores logicos dos campos.',
    origin: 'SORT no JCL sem mutacao de conteudo',
  },
  copia_enriquecimento_registro: {
    key: 'copia_enriquecimento_registro',
    label: 'Copia com enriquecimento',
    description: 'Preserva a maior parte do registro, mas injeta ou sobrepoe conteudo adicional.',
    origin: 'OUTREC/INREC OVERLAY, SORT FIELDS=COPY com enriquecimento',
  },
  busca_valor: {
    key: 'busca_valor',
    label: 'Busca de valor',
    description: 'Busca valor externo e o propaga para o campo de saida.',
    origin: 'COBOL com SQL/DB2, SELECT INTO e propagacao posterior',
  },
  uso_chave_busca: {
    key: 'uso_chave_busca',
    label: 'Uso de chave de busca',
    description: 'Campo usado como predicado ou chave para localizar dado externo.',
    origin: 'COBOL com SQL/DB2 em clausulas WHERE ou chaves de pesquisa',
  },
  calculo_derivado: {
    key: 'calculo_derivado',
    label: 'Calculo derivado',
    description: 'Campo derivado por formula ou operacao numerica.',
    origin: 'COBOL COMPUTE, operacoes aritmeticas e agregacoes',
  },
  derivacao_condicional: {
    key: 'derivacao_condicional',
    label: 'Derivacao condicional',
    description: 'Campo derivado por regra condicional cujo resultado vem de dado nao literal.',
    origin: 'COBOL IF, EVALUATE e regras de decisao com campos/variaveis',
  },
  constante_condicional: {
    key: 'constante_condicional',
    label: 'Constante condicional',
    description: 'Campo preenchido por literal escolhido dentro de uma logica condicional.',
    origin: 'COBOL IF/EVALUATE com saida hard code por ramo',
  },
  constante_literal: {
    key: 'constante_literal',
    label: 'Constante literal',
    description: 'Campo preenchido por literal fixo fora de uma derivacao condicional relevante.',
    origin: 'JCL, COBOL MOVE literal ou valor default fixo',
  },
  nao_classificada: {
    key: 'nao_classificada',
    label: 'Transformacao nao classificada',
    description: 'Ainda nao foi mapeada para a taxonomia padronizada.',
    origin: 'Indefinido',
  },
};

function isConditionalLiteralAssignmentExpression(expression?: string): boolean {
  const normalized = String(expression || '').toUpperCase();
  if (!normalized) {
    return false;
  }

  const hasConditionalContext =
    normalized.includes('IF ') ||
    normalized.startsWith('IF') ||
    normalized.includes('EVALUATE') ||
    normalized.includes(' WHEN ');

  if (!hasConditionalContext) {
    return false;
  }

  return (
    /\bTHEN\s+'[^']*'/.test(normalized) ||
    /\bELSE\s+'[^']*'/.test(normalized) ||
    /\bTHEN\s+[-+]?\d+(?:[.,]\d+)?\b/.test(normalized) ||
    /\bELSE\s+[-+]?\d+(?:[.,]\d+)?\b/.test(normalized) ||
    /\bMOVE\s+'[^']*'\s+TO\b/.test(normalized) ||
    /\bMOVE\s+[-+]?\d+(?:[.,]\d+)?\s+TO\b/.test(normalized)
  );
}

export function normalizeMainframeTransformation(
  ruleType?: string,
  ruleSubtype?: string,
  expression?: string,
): MainframeTransformationSpec {
  const type = String(ruleType || '').toLowerCase();
  const subtype = String(ruleSubtype || '').toLowerCase();

  if (subtype && TRANSFORMATION_SPECS[subtype]) {
    return TRANSFORMATION_SPECS[subtype];
  }

  if (
    subtype === 'pass_through' ||
    (type === 'copy' && subtype === 'identity') ||
    (type === 'move' && subtype === 'direct') ||
    (type === 'copy' && subtype === 'direct')
  ) {
    return TRANSFORMATION_SPECS.copia_identidade;
  }

  if (subtype === 'reorder_only' || (type === 'sort' && subtype === 'identity_preserving')) {
    return TRANSFORMATION_SPECS.reordenacao_registro;
  }

  if (
    subtype === 'copy_overlay' ||
    subtype === 'overlay_enrichment' ||
    (type === 'sort' && (subtype === 'copy_overlay' || subtype === 'overlay_enrichment'))
  ) {
    return TRANSFORMATION_SPECS.copia_enriquecimento_registro;
  }

  if (subtype === 'lookup_fetch' || (type === 'db_lookup' && subtype === 'select_into')) {
    return TRANSFORMATION_SPECS.busca_valor;
  }

  if (subtype === 'lookup_key' || (type === 'db_lookup' && subtype === 'join_key')) {
    return TRANSFORMATION_SPECS.uso_chave_busca;
  }

  if (subtype === 'arithmetic_compute' || type === 'compute') {
    return TRANSFORMATION_SPECS.calculo_derivado;
  }

  if (subtype === 'conditional_assignment' || (type === 'conditional' && subtype === 'if_else')) {
    return isConditionalLiteralAssignmentExpression(expression)
      ? TRANSFORMATION_SPECS.constante_condicional
      : TRANSFORMATION_SPECS.derivacao_condicional;
  }

  if (subtype === 'constant_assignment' || type === 'constant' || subtype === 'literal') {
    return TRANSFORMATION_SPECS.constante_literal;
  }

  if (subtype === 'unknown' || subtype === 'unclassified') {
    return TRANSFORMATION_SPECS.nao_classificada;
  }

  return TRANSFORMATION_SPECS.nao_classificada;
}

export function isMainframeHardCodeTransformation(
  ruleType?: string,
  ruleSubtype?: string,
  expression?: string,
): boolean {
  const normalized = normalizeMainframeTransformation(ruleType, ruleSubtype, expression).key;
  return normalized === 'constante_literal' || normalized === 'constante_condicional';
}

export function formatRawTransformation(ruleType?: string, ruleSubtype?: string): string {
  const type = String(ruleType || 'unknown').toLowerCase();
  const subtype = String(ruleSubtype || 'unknown').toLowerCase();
  return `${type}/${subtype}`;
}
