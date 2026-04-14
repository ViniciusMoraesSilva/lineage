import * as XLSX from 'xlsx';

import { buildColumnFieldKey, computeColumnFieldLineageStatus, splitColumnFieldKey } from '@/lib/columnFieldLineage';
import {
    CLASSIFICATION_WORKBOOK_SHEETS,
    classifyMainframeField,
    resolveClassificationWorkbookScope,
    type MainframeClassificationCategory,
    type MainframeClassificationDetailedReason,
    type MainframeClassificationWorkbookScope,
} from '@/lib/mainframe/classificationWorkbookContract';
import type { ColumnLineageEdge, ParsedFieldRule, ParsedLineage } from '@/lib/types';

export interface ClassificationFieldSelection {
    datasetKey: string;
    field: string;
}

export interface BuildClassificationWorkbookOptions {
    selectedFields?: ClassificationFieldSelection[];
    visibleFields?: ClassificationFieldSelection[];
    now?: Date;
}

export interface ClassificationDetailRow {
    dataset: string;
    campo: string;
    categoria_principal: MainframeClassificationCategory;
    motivo_detalhado: MainframeClassificationDetailedReason;
    responde_direto_origem: 'Sim' | 'Nao';
    responde_hard_code: 'Sim' | 'Nao';
    responde_gerado_fluxo: 'Sim' | 'Nao';
    sinal_hard_code_indireto: 'Sim' | 'Nao';
    transformacao_referencia: string;
    origem_dataset_referencia: string;
    origem_campo_referencia: string;
    step_referencia: string;
    observacao: string;
}

export interface ClassificationWorkbookSummary {
    totalCampos: number;
    totalDiretoOrigem: number;
    totalHardCode: number;
    totalGeradoFluxo: number;
}

export interface MainframeFieldClassificationResult {
    scope: MainframeClassificationWorkbookScope;
    selectedFields: ClassificationFieldSelection[];
    summary: ClassificationWorkbookSummary;
    rowsByCategory: Record<MainframeClassificationCategory, ClassificationDetailRow[]>;
}

export interface ClassificationWorkbookBuildResult {
    workbook: XLSX.WorkBook;
    fileName: string;
    classification: MainframeFieldClassificationResult;
}

interface TraversalReference {
    transformationKey?: string;
    transformationLabel?: string;
    sourceDataset?: string;
    sourceField?: string;
    stepName?: string;
    stepId?: string;
    distance: number;
}

interface TraversalAnalysis {
    directTransformationKeys: string[];
    upstreamTransformationKeys: string[];
    directHardCodeReference?: TraversalReference;
    indirectHardCodeReference?: TraversalReference;
    generatedReference?: TraversalReference;
    originReference?: TraversalReference;
}

interface TraversalContext {
    inboundEdgesByField: Map<string, ColumnLineageEdge[]>;
    fieldRules: Record<string, ParsedFieldRule[]>;
    cache: Map<string, TraversalAnalysis>;
}

const CATEGORY_EMPTY_ROWS: Record<MainframeClassificationCategory, ClassificationDetailRow[]> = {
    direto_origem: [],
    hard_code: [],
    gerado_fluxo: [],
};

export function buildMainframeFieldClassificationRows(
    data: ParsedLineage,
    options: BuildClassificationWorkbookOptions = {},
): MainframeFieldClassificationResult {
    const selectedFields = resolveFieldsForWorkbook(data, options);
    const scope = resolveClassificationWorkbookScope((options.selectedFields || []).length);
    const statuses = computeColumnFieldLineageStatus(data);
    const traversalContext = createTraversalContext(data);

    const rowsByCategory: Record<MainframeClassificationCategory, ClassificationDetailRow[]> = {
        direto_origem: [],
        hard_code: [],
        gerado_fluxo: [],
    };

    for (const fieldSelection of selectedFields) {
        const fieldKey = buildColumnFieldKey(fieldSelection.datasetKey, fieldSelection.field);
        const analysis = resolveTraversalAnalysis(fieldKey, traversalContext);
        const classification = classifyMainframeField({
            lineageStatus: statuses[fieldKey] || 'unfilled',
            directTransformationKeys: analysis.directTransformationKeys,
            upstreamTransformationKeys: analysis.upstreamTransformationKeys,
        });

        rowsByCategory[classification.category].push(
            buildClassificationDetailRow(fieldSelection, classification.category, classification.reason, classification, analysis),
        );
    }

    for (const category of Object.keys(rowsByCategory) as MainframeClassificationCategory[]) {
        rowsByCategory[category] = rowsByCategory[category].sort(compareClassificationRows);
    }

    return {
        scope,
        selectedFields,
        summary: {
            totalCampos: selectedFields.length,
            totalDiretoOrigem: rowsByCategory.direto_origem.length,
            totalHardCode: rowsByCategory.hard_code.length,
            totalGeradoFluxo: rowsByCategory.gerado_fluxo.length,
        },
        rowsByCategory,
    };
}

export function buildClassificationWorkbook(
    data: ParsedLineage,
    options: BuildClassificationWorkbookOptions = {},
): ClassificationWorkbookBuildResult {
    const classification = buildMainframeFieldClassificationRows(data, options);
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([
        {
            escopo_workbook: classification.scope,
            regra_prioridade: 'hard_code > gerado_fluxo > direto_origem',
            total_campos: classification.summary.totalCampos,
            total_direto_origem: classification.summary.totalDiretoOrigem,
            total_hard_code: classification.summary.totalHardCode,
            total_gerado_fluxo: classification.summary.totalGeradoFluxo,
        },
    ]);
    summarySheet['!cols'] = buildSheetColumnWidths(CLASSIFICATION_WORKBOOK_SHEETS[0].columns, [
        {
            escopo_workbook: classification.scope,
            regra_prioridade: 'hard_code > gerado_fluxo > direto_origem',
            total_campos: classification.summary.totalCampos,
            total_direto_origem: classification.summary.totalDiretoOrigem,
            total_hard_code: classification.summary.totalHardCode,
            total_gerado_fluxo: classification.summary.totalGeradoFluxo,
        },
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    for (const sheet of CLASSIFICATION_WORKBOOK_SHEETS) {
        if (sheet.key === 'resumo') {
            continue;
        }

        const rows = classification.rowsByCategory[sheet.key];
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...sheet.columns] });
        worksheet['!cols'] = buildSheetColumnWidths(sheet.columns, rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }

    return {
        workbook,
        fileName: buildClassificationWorkbookFileName(data, classification.scope, options.now),
        classification,
    };
}

export function exportClassificationExcel(
    data: ParsedLineage,
    options: BuildClassificationWorkbookOptions = {},
): void {
    const { workbook, fileName } = buildClassificationWorkbook(data, options);
    XLSX.writeFile(workbook, fileName);
}

function resolveFieldsForWorkbook(
    data: ParsedLineage,
    options: BuildClassificationWorkbookOptions,
): ClassificationFieldSelection[] {
    const preferred = (options.selectedFields || []).length > 0
        ? options.selectedFields || []
        : (options.visibleFields || []).length > 0
            ? options.visibleFields || []
            : deriveDefaultVisibleFields(data);

    const seen = new Set<string>();
    return preferred.filter((fieldSelection) => {
        const key = `${fieldSelection.datasetKey}::${fieldSelection.field}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function deriveDefaultVisibleFields(data: ParsedLineage): ClassificationFieldSelection[] {
    return data.datasets
        .filter((dataset) => dataset.role !== 'source')
        .flatMap((dataset) => {
            const datasetKey = `${dataset.namespace}::${dataset.name}`;
            return dataset.schema.map((field) => ({
                datasetKey,
                field: field.name,
            }));
        });
}

function createTraversalContext(data: ParsedLineage): TraversalContext {
    const inboundEdgesByField = new Map<string, ColumnLineageEdge[]>();
    for (const edge of data.columnLineageEdges) {
        const fieldKey = buildColumnFieldKey(edge.targetDataset, edge.targetField);
        const existing = inboundEdgesByField.get(fieldKey);
        if (existing) {
            existing.push(edge);
        } else {
            inboundEdgesByField.set(fieldKey, [edge]);
        }
    }

    return {
        inboundEdgesByField,
        fieldRules: data.fieldRules || {},
        cache: new Map<string, TraversalAnalysis>(),
    };
}

function resolveTraversalAnalysis(fieldKey: string, context: TraversalContext): TraversalAnalysis {
    const cached = context.cache.get(fieldKey);
    if (cached) {
        return cached;
    }

    const directEdges = context.inboundEdgesByField.get(fieldKey) || [];
    const directRules = context.fieldRules[fieldKey] || [];
    const directTransformationKeys = uniqueStrings([
        ...directEdges.map((edge) => edge.standardTransformationKey),
        ...directRules.map((rule) => rule.standardTransformationKey),
    ]);

    const upstreamTransformationKeys = new Set<string>();
    const queue = directEdges.map((edge) => ({
        fieldKey: buildColumnFieldKey(edge.sourceDataset, edge.sourceField),
        distance: 1,
    }));
    const visited = new Set<string>();

    let directHardCodeReference = selectPreferredReference([
        ...directEdges.map((edge) => edgeToReference(edge, 0)),
        ...directRules.map((rule) => ruleToReference(fieldKey, rule, 0)),
    ], isHardCodeTransformationKey);
    let indirectHardCodeReference: TraversalReference | undefined;
    let generatedReference: TraversalReference | undefined = selectPreferredReference([
        ...directEdges.map((edge) => edgeToReference(edge, 0)),
        ...directRules.map((rule) => ruleToReference(fieldKey, rule, 0)),
    ], isGeneratedTransformationKey);
    let originReference: TraversalReference | undefined;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current.fieldKey)) {
            continue;
        }
        visited.add(current.fieldKey);

        const inboundEdges = context.inboundEdgesByField.get(current.fieldKey) || [];
        const rules = context.fieldRules[current.fieldKey] || [];

        if (!originReference && inboundEdges.length === 0) {
            const { datasetKey, field } = splitColumnFieldKey(current.fieldKey);
            originReference = {
                sourceDataset: datasetKey,
                sourceField: field,
                distance: current.distance,
            };
        }

        for (const edge of inboundEdges) {
            if (edge.standardTransformationKey) {
                upstreamTransformationKeys.add(edge.standardTransformationKey);
            }
            const reference = edgeToReference(edge, current.distance);
            if (!indirectHardCodeReference && isHardCodeTransformationKey(reference.transformationKey)) {
                indirectHardCodeReference = reference;
            }
            if (!generatedReference && isGeneratedTransformationKey(reference.transformationKey)) {
                generatedReference = reference;
            }
            queue.push({
                fieldKey: buildColumnFieldKey(edge.sourceDataset, edge.sourceField),
                distance: current.distance + 1,
            });
        }

        for (const rule of rules) {
            if (rule.standardTransformationKey) {
                upstreamTransformationKeys.add(rule.standardTransformationKey);
            }
            const reference = ruleToReference(current.fieldKey, rule, current.distance);
            if (!indirectHardCodeReference && isHardCodeTransformationKey(reference.transformationKey)) {
                indirectHardCodeReference = reference;
            }
            if (!generatedReference && isGeneratedTransformationKey(reference.transformationKey)) {
                generatedReference = reference;
            }
        }
    }

    const analysis = {
        directTransformationKeys,
        upstreamTransformationKeys: [...upstreamTransformationKeys],
        directHardCodeReference,
        indirectHardCodeReference,
        generatedReference,
        originReference,
    };
    context.cache.set(fieldKey, analysis);
    return analysis;
}

function buildClassificationDetailRow(
    fieldSelection: ClassificationFieldSelection,
    category: MainframeClassificationCategory,
    reason: MainframeClassificationDetailedReason,
    classification: ReturnType<typeof classifyMainframeField>,
    analysis: TraversalAnalysis,
): ClassificationDetailRow {
    const reference = resolveReferenceForRow(category, reason, analysis);

    return {
        dataset: shortDatasetName(fieldSelection.datasetKey),
        campo: fieldSelection.field,
        categoria_principal: category,
        motivo_detalhado: reason,
        responde_direto_origem: classification.answers.diretoOrigem ? 'Sim' : 'Nao',
        responde_hard_code: classification.answers.hardCode ? 'Sim' : 'Nao',
        responde_gerado_fluxo: classification.answers.geradoFluxo ? 'Sim' : 'Nao',
        sinal_hard_code_indireto: classification.secondarySignals.hasIndirectHardCode ? 'Sim' : 'Nao',
        transformacao_referencia: reference?.transformationLabel || '',
        origem_dataset_referencia: shortDatasetName(reference?.sourceDataset),
        origem_campo_referencia: reference?.sourceField || '',
        step_referencia: reference?.stepName || reference?.stepId || '',
        observacao: buildObservation(category, reason, classification, reference),
    };
}

function resolveReferenceForRow(
    category: MainframeClassificationCategory,
    reason: MainframeClassificationDetailedReason,
    analysis: TraversalAnalysis,
): TraversalReference | undefined {
    if (category === 'hard_code') {
        return reason === 'hard_code_direto'
            ? analysis.directHardCodeReference || analysis.indirectHardCodeReference
            : analysis.indirectHardCodeReference || analysis.directHardCodeReference;
    }

    if (category === 'gerado_fluxo') {
        return analysis.generatedReference;
    }

    return analysis.originReference;
}

function buildObservation(
    category: MainframeClassificationCategory,
    reason: MainframeClassificationDetailedReason,
    classification: ReturnType<typeof classifyMainframeField>,
    reference?: TraversalReference,
): string {
    if (reason === 'gerado_sem_upstream') {
        return 'Sem upstream resolvido no lineage atual.';
    }

    if (category === 'hard_code' && reason === 'hard_code_indireto') {
        const originDataset = shortDatasetName(reference?.sourceDataset);
        const originField = reference?.sourceField || 'valor literal';
        if (originDataset) {
            return `Usa hard code herdado via upstream a partir de ${originDataset}.${originField}.`;
        }
        return 'Usa hard code herdado em algum ponto do upstream.';
    }

    if (category === 'hard_code' && reason === 'hard_code_direto') {
        return 'O valor final recebe hard code diretamente no campo classificado.';
    }

    if (category === 'direto_origem') {
        const originDataset = shortDatasetName(reference?.sourceDataset);
        const originField = reference?.sourceField || '';
        if (originDataset && originField) {
            return `Campo preservado desde a origem ${originDataset}.${originField}.`;
        }
        return 'Campo preservado por copia de identidade ao longo do fluxo.';
    }

    if (classification.secondarySignals.hasGeneratedTransformation) {
        return 'Campo derivado por transformacao local do fluxo.';
    }

    return 'Campo gerado dentro do fluxo conforme a semantica atual do viewer.';
}

function buildClassificationWorkbookFileName(
    data: ParsedLineage,
    scope: MainframeClassificationWorkbookScope,
    now = new Date(),
): string {
    const timestamp = now.toISOString().slice(0, 10);
    const jclName = (data.jclNames || []).find(Boolean) || 'bundle';
    const scopeLabel = scope === 'selected_fields' ? 'campos_selecionados' : 'campos_visiveis';
    return `classificacao_campos_${jclName}_${scopeLabel}_${timestamp}.xlsx`;
}

function buildSheetColumnWidths<T extends object>(columns: string[], rows: T[]): Array<{ wch: number }> {
    return columns.map((column) => {
        const maxValueLength = rows.reduce((maxLength, row) => {
            const value = (row as Record<string, unknown>)[column];
            return Math.max(maxLength, String(value ?? '').length);
        }, column.length);
        return { wch: Math.min(Math.max(maxValueLength + 2, 14), 42) };
    });
}

function edgeToReference(edge: ColumnLineageEdge, distance: number): TraversalReference {
    return {
        transformationKey: edge.standardTransformationKey,
        transformationLabel: edge.standardTransformationLabel,
        sourceDataset: edge.sourceDataset,
        sourceField: edge.sourceField,
        stepName: edge.stepName,
        stepId: edge.stepId,
        distance,
    };
}

function ruleToReference(fieldKey: string, rule: ParsedFieldRule, distance: number): TraversalReference {
    const { datasetKey, field } = splitColumnFieldKey(fieldKey);
    return {
        transformationKey: rule.standardTransformationKey,
        transformationLabel: rule.standardTransformationLabel,
        sourceDataset: datasetKey,
        sourceField: field,
        stepName: rule.stepName,
        stepId: rule.stepId,
        distance,
    };
}

function selectPreferredReference(
    references: TraversalReference[],
    predicate: (transformationKey?: string) => boolean,
): TraversalReference | undefined {
    return references
        .filter((reference) => predicate(reference.transformationKey))
        .sort((left, right) => left.distance - right.distance)[0];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isHardCodeTransformationKey(transformationKey?: string): boolean {
    return transformationKey === 'constante_literal' || transformationKey === 'constante_condicional';
}

function isGeneratedTransformationKey(transformationKey?: string): boolean {
    return Boolean(transformationKey) && !isHardCodeTransformationKey(transformationKey)
        && transformationKey !== 'copia_identidade'
        && transformationKey !== 'reordenacao_registro';
}

function shortDatasetName(datasetKey?: string): string {
    if (!datasetKey) {
        return '';
    }
    const parts = datasetKey.split('::');
    return parts[parts.length - 1] || datasetKey;
}

function compareClassificationRows(left: ClassificationDetailRow, right: ClassificationDetailRow): number {
    const byDataset = left.dataset.localeCompare(right.dataset);
    if (byDataset !== 0) {
        return byDataset;
    }
    return left.campo.localeCompare(right.campo);
}