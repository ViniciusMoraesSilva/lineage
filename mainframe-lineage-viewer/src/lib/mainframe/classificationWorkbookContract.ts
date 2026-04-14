import type { ColumnFieldLineageStatus } from '@/lib/types';

export const MAINFRAME_CLASSIFICATION_CATEGORY_PRIORITY = [
  'hard_code',
  'gerado_fluxo',
  'direto_origem',
] as const;

export type MainframeClassificationCategory = typeof MAINFRAME_CLASSIFICATION_CATEGORY_PRIORITY[number];

export type MainframeClassificationWorkbookScope = 'selected_fields' | 'visible_filtered_fields';

export type MainframeClassificationDetailedReason =
  | 'copia_identidade'
  | 'reordenacao_registro'
  | 'hard_code_direto'
  | 'hard_code_indireto'
  | 'copia_enriquecimento_registro'
  | 'busca_valor'
  | 'uso_chave_busca'
  | 'calculo_derivado'
  | 'derivacao_condicional'
  | 'gerado_sem_upstream'
  | 'transformacao_nao_classificada';

export interface MainframeClassificationSignals {
  lineageStatus: ColumnFieldLineageStatus;
  directTransformationKeys?: string[];
  upstreamTransformationKeys?: string[];
}

export interface MainframeFieldClassification {
  category: MainframeClassificationCategory;
  reason: MainframeClassificationDetailedReason;
  answers: {
    diretoOrigem: boolean;
    hardCode: boolean;
    geradoFluxo: boolean;
  };
  secondarySignals: {
    hasDirectHardCode: boolean;
    hasIndirectHardCode: boolean;
    hasGeneratedTransformation: boolean;
    hasIdentityOnlyLineage: boolean;
    hasUnresolvedUpstream: boolean;
  };
}

export interface ClassificationWorkbookSheetContract {
  key: 'resumo' | MainframeClassificationCategory;
  name: string;
  columns: string[];
}

const HARD_CODE_TRANSFORMATION_KEYS = new Set(['constante_literal', 'constante_condicional']);
const IDENTITY_PRESERVING_TRANSFORMATION_KEYS = new Set(['copia_identidade', 'reordenacao_registro']);
const GENERATED_REASON_PRIORITY: MainframeClassificationDetailedReason[] = [
  'calculo_derivado',
  'derivacao_condicional',
  'busca_valor',
  'uso_chave_busca',
  'copia_enriquecimento_registro',
  'transformacao_nao_classificada',
  'gerado_sem_upstream',
];
const DIRECT_REASON_PRIORITY: MainframeClassificationDetailedReason[] = [
  'reordenacao_registro',
  'copia_identidade',
];

export const CLASSIFICATION_WORKBOOK_DETAIL_COLUMNS = [
  'dataset',
  'campo',
  'categoria_principal',
  'motivo_detalhado',
  'responde_direto_origem',
  'responde_hard_code',
  'responde_gerado_fluxo',
  'sinal_hard_code_indireto',
  'transformacao_referencia',
  'origem_dataset_referencia',
  'origem_campo_referencia',
  'step_referencia',
  'observacao',
] as const;

export const CLASSIFICATION_WORKBOOK_SHEETS: ClassificationWorkbookSheetContract[] = [
  {
    key: 'resumo',
    name: 'Resumo',
    columns: [
      'escopo_workbook',
      'regra_prioridade',
      'total_campos',
      'total_direto_origem',
      'total_hard_code',
      'total_gerado_fluxo',
    ],
  },
  {
    key: 'direto_origem',
    name: 'Direto origem',
    columns: [...CLASSIFICATION_WORKBOOK_DETAIL_COLUMNS],
  },
  {
    key: 'hard_code',
    name: 'Hard code',
    columns: [...CLASSIFICATION_WORKBOOK_DETAIL_COLUMNS],
  },
  {
    key: 'gerado_fluxo',
    name: 'Gerado fluxo',
    columns: [...CLASSIFICATION_WORKBOOK_DETAIL_COLUMNS],
  },
];

export function resolveClassificationWorkbookScope(
  selectedFieldsCount: number,
): MainframeClassificationWorkbookScope {
  return selectedFieldsCount > 0 ? 'selected_fields' : 'visible_filtered_fields';
}

export function classifyMainframeField(
  signals: MainframeClassificationSignals,
): MainframeFieldClassification {
  const directKeys = normalizeTransformationKeys(signals.directTransformationKeys);
  const upstreamKeys = normalizeTransformationKeys(signals.upstreamTransformationKeys);
  const allKeys = [...directKeys, ...upstreamKeys];

  const hasDirectHardCode = directKeys.some((key) => HARD_CODE_TRANSFORMATION_KEYS.has(key));
  const hasIndirectHardCode = upstreamKeys.some((key) => HARD_CODE_TRANSFORMATION_KEYS.has(key));
  const generatedKeys = allKeys
    .filter((key) => !HARD_CODE_TRANSFORMATION_KEYS.has(key))
    .filter((key) => !IDENTITY_PRESERVING_TRANSFORMATION_KEYS.has(key));
  const hasGeneratedTransformation = generatedKeys.length > 0;
  const hasUnresolvedUpstream = signals.lineageStatus === 'unfilled';
  const hasIdentityOnlyLineage =
    signals.lineageStatus === 'resolved' &&
    !hasDirectHardCode &&
    !hasIndirectHardCode &&
    !hasGeneratedTransformation;

  if (hasDirectHardCode) {
    return buildClassification('hard_code', 'hard_code_direto', {
      hasDirectHardCode,
      hasIndirectHardCode,
      hasGeneratedTransformation,
      hasIdentityOnlyLineage,
      hasUnresolvedUpstream,
    });
  }

  if (hasIndirectHardCode) {
    return buildClassification('hard_code', 'hard_code_indireto', {
      hasDirectHardCode,
      hasIndirectHardCode,
      hasGeneratedTransformation,
      hasIdentityOnlyLineage,
      hasUnresolvedUpstream,
    });
  }

  if (hasGeneratedTransformation || hasUnresolvedUpstream) {
    return buildClassification(
      'gerado_fluxo',
      resolveGeneratedReason(directKeys, upstreamKeys, signals.lineageStatus),
      {
        hasDirectHardCode,
        hasIndirectHardCode,
        hasGeneratedTransformation,
        hasIdentityOnlyLineage,
        hasUnresolvedUpstream,
      },
    );
  }

  return buildClassification(
    'direto_origem',
    resolveDirectReason(directKeys, upstreamKeys),
    {
      hasDirectHardCode,
      hasIndirectHardCode,
      hasGeneratedTransformation,
      hasIdentityOnlyLineage,
      hasUnresolvedUpstream,
    },
  );
}

function buildClassification(
  category: MainframeClassificationCategory,
  reason: MainframeClassificationDetailedReason,
  secondarySignals: MainframeFieldClassification['secondarySignals'],
): MainframeFieldClassification {
  return {
    category,
    reason,
    answers: {
      diretoOrigem: category === 'direto_origem',
      hardCode: category === 'hard_code',
      geradoFluxo: category === 'gerado_fluxo',
    },
    secondarySignals,
  };
}

function normalizeTransformationKeys(keys?: string[]): string[] {
  return (keys || []).map((key) => normalizeTransformationKey(key)).filter(Boolean);
}

function normalizeTransformationKey(key?: string): string {
  return String(key || '').trim().toLowerCase();
}

function resolveGeneratedReason(
  directKeys: string[],
  upstreamKeys: string[],
  lineageStatus: ColumnFieldLineageStatus,
): MainframeClassificationDetailedReason {
  const generatedKeys = [...directKeys, ...upstreamKeys]
    .filter((key) => !HARD_CODE_TRANSFORMATION_KEYS.has(key))
    .filter((key) => !IDENTITY_PRESERVING_TRANSFORMATION_KEYS.has(key))
    .map(mapGeneratedReason);

  for (const reason of GENERATED_REASON_PRIORITY) {
    if (generatedKeys.includes(reason)) {
      return reason;
    }
  }

  if (lineageStatus === 'unfilled') {
    return 'gerado_sem_upstream';
  }

  return 'transformacao_nao_classificada';
}

function resolveDirectReason(
  directKeys: string[],
  upstreamKeys: string[],
): MainframeClassificationDetailedReason {
  const directReasons = [...directKeys, ...upstreamKeys]
    .filter((key) => IDENTITY_PRESERVING_TRANSFORMATION_KEYS.has(key))
    .map((key) => key as MainframeClassificationDetailedReason);

  for (const reason of DIRECT_REASON_PRIORITY) {
    if (directReasons.includes(reason)) {
      return reason;
    }
  }

  return 'copia_identidade';
}

function mapGeneratedReason(key: string): MainframeClassificationDetailedReason {
  switch (key) {
    case 'calculo_derivado':
    case 'derivacao_condicional':
    case 'busca_valor':
    case 'uso_chave_busca':
    case 'copia_enriquecimento_registro':
      return key;
    default:
      return 'transformacao_nao_classificada';
  }
}