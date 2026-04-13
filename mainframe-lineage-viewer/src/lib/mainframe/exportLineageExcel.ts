import * as XLSX from 'xlsx';
import type { ParsedLineage, ParsedFieldRule, ColumnLineageEdge } from '@/lib/types';

interface ResolvedFieldRule extends ParsedFieldRule {
    inherited: boolean;
    originFieldKey: string;
    upstreamDistance: number;
}

interface FieldSelection {
    datasetKey: string;
    field: string;
}

interface TracedEdge {
    edge: ColumnLineageEdge;
    distance: number;
}

/**
 * Traces upstream fields contributing to a target field — returns edges with distance from target.
 * Distance 1 = edge directly feeding the target field.
 */
function traceUpstreamEdges(
    targetDatasetKey: string,
    targetField: string,
    edges: ColumnLineageEdge[],
): TracedEdge[] {
    const result: TracedEdge[] = [];
    const visited = new Set<string>();
    const queue: Array<{ key: string; distance: number }> = [{ key: `${targetDatasetKey}::${targetField}`, distance: 0 }];

    while (queue.length) {
        const current = queue.shift()!;
        if (visited.has(current.key)) continue;
        visited.add(current.key);

        for (const edge of edges) {
            const tgtKey = `${edge.targetDataset}::${edge.targetField}`;
            if (tgtKey === current.key) {
                result.push({ edge, distance: current.distance + 1 });
                const srcKey = `${edge.sourceDataset}::${edge.sourceField}`;
                if (!visited.has(srcKey)) {
                    queue.push({ key: srcKey, distance: current.distance + 1 });
                }
            }
        }
    }

    // Sort: furthest upstream first (highest distance first)
    return result.sort((a, b) => b.distance - a.distance);
}

/**
 * Resolves all rules (direct + inherited via upstream BFS) for a single field.
 */
function resolveFieldRules(
    data: ParsedLineage,
    selectedField: FieldSelection,
): ResolvedFieldRule[] {
    if (!data.fieldRules) return [];

    const selectedFieldKey = `${selectedField.datasetKey}::${selectedField.field}`;
    const inboundEdges = new Map<string, string[]>();

    for (const edge of data.columnLineageEdges) {
        const targetKey = `${edge.targetDataset}::${edge.targetField}`;
        const sourceKey = `${edge.sourceDataset}::${edge.sourceField}`;
        const list = inboundEdges.get(targetKey) || [];
        list.push(sourceKey);
        inboundEdges.set(targetKey, list);
    }

    const queue = [{ fieldKey: selectedFieldKey, distance: 0 }];
    const visited = new Set<string>();
    const collected = new Map<string, ResolvedFieldRule>();

    while (queue.length) {
        const current = queue.shift();
        if (!current || visited.has(current.fieldKey)) continue;
        visited.add(current.fieldKey);

        for (const rule of data.fieldRules[current.fieldKey] || []) {
            const dedupeKey = `${rule.ruleId}::${rule.stepId}::${rule.expression}`;
            const resolved: ResolvedFieldRule = {
                ...rule,
                inherited: current.fieldKey !== selectedFieldKey,
                originFieldKey: current.fieldKey,
                upstreamDistance: current.distance,
            };
            const existing = collected.get(dedupeKey);
            if (
                !existing ||
                resolved.upstreamDistance < existing.upstreamDistance ||
                (resolved.upstreamDistance === existing.upstreamDistance && !resolved.inherited && existing.inherited)
            ) {
                collected.set(dedupeKey, resolved);
            }
        }

        for (const sourceKey of inboundEdges.get(current.fieldKey) || []) {
            if (!visited.has(sourceKey)) {
                queue.push({ fieldKey: sourceKey, distance: current.distance + 1 });
            }
        }
    }

    return Array.from(collected.values()).sort((a, b) => {
        if (a.inherited !== b.inherited) return a.inherited ? 1 : -1;
        if (a.upstreamDistance !== b.upstreamDistance) return a.upstreamDistance - b.upstreamDistance;
        return a.ruleId.localeCompare(b.ruleId);
    });
}

function shortName(datasetKey: string): string {
    const parts = datasetKey.split('::');
    return parts[parts.length - 1] || datasetKey;
}

export function exportLineageExcel(
    data: ParsedLineage,
    selectedFields: FieldSelection[],
): void {
    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Linhagem (upstream chain per selected field) ---
    const lineageRows: Record<string, string>[] = [];
    for (const sf of selectedFields) {
        const upstreamEdges = traceUpstreamEdges(sf.datasetKey, sf.field, data.columnLineageEdges);
        if (upstreamEdges.length === 0) {
            lineageRows.push({
                'Campo Selecionado': sf.field,
                'Dataset Selecionado': shortName(sf.datasetKey),
                'Sequência': '',
                'Campo Origem': '(sem upstream)',
                'Dataset Origem': '',
                'Campo Destino': sf.field,
                'Dataset Destino': shortName(sf.datasetKey),
                'Transformação': '',
                'Step': '',
            });
            continue;
        }
        for (let i = 0; i < upstreamEdges.length; i++) {
            const { edge } = upstreamEdges[i];
            lineageRows.push({
                'Campo Selecionado': sf.field,
                'Dataset Selecionado': shortName(sf.datasetKey),
                'Sequência': `${i + 1}`,
                'Campo Origem': edge.sourceField,
                'Dataset Origem': shortName(edge.sourceDataset),
                'Campo Destino': edge.targetField,
                'Dataset Destino': shortName(edge.targetDataset),
                'Transformação': edge.standardTransformationLabel || `${edge.transformationType}/${edge.transformationSubtype}`,
                'Step': edge.stepName || edge.stepId || '',
            });
        }
    }

    const wsLineage = XLSX.utils.json_to_sheet(lineageRows);
    wsLineage['!cols'] = [
        { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 30 },
        { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLineage, 'Linhagem');

    // --- Sheet 2: Regras (rules per selected field) ---
    const ruleRows: Record<string, string>[] = [];
    for (const sf of selectedFields) {
        const rules = resolveFieldRules(data, sf);
        if (rules.length === 0) {
            ruleRows.push({
                'Campo': sf.field,
                'Dataset': shortName(sf.datasetKey),
                'Sequência': '',
                'Regra ID': '(sem regras)',
                'Step': '',
                'Tipo': '',
                'Transformação': '',
                'Expressão': '',
                'Descrição': '',
                'Programa': '',
                'Herdada': '',
                'Distância Upstream': '',
                'Origem': '',
            });
            continue;
        }
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            ruleRows.push({
                'Campo': sf.field,
                'Dataset': shortName(sf.datasetKey),
                'Sequência': `${rules.length - i}`,
                'Regra ID': rule.ruleId,
                'Step': rule.stepName || rule.stepId || '',
                'Tipo': `${rule.ruleType}/${rule.ruleSubtype}`,
                'Transformação': rule.standardTransformationLabel || '',
                'Expressão': rule.expression || '',
                'Descrição': rule.description || '',
                'Programa': rule.programName || '',
                'Herdada': rule.inherited ? 'Sim' : 'Não',
                'Distância Upstream': String(rule.upstreamDistance),
                'Origem': rule.inherited ? shortName(rule.originFieldKey) : '',
            });
        }
    }

    const wsRules = XLSX.utils.json_to_sheet(ruleRows);
    wsRules['!cols'] = [
        { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
        { wch: 25 }, { wch: 25 }, { wch: 40 }, { wch: 40 },
        { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRules, 'Regras');

    // --- Generate filename and download ---
    const timestamp = new Date().toISOString().slice(0, 10);
    const fieldNames = selectedFields.slice(0, 3).map((f) => f.field).join('_');
    const suffix = selectedFields.length > 3 ? `_+${selectedFields.length - 3}` : '';
    const fileName = `linhagem_${fieldNames}${suffix}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, fileName);
}
