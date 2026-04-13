import type { ColumnFieldLineageStatus, ParsedLineage } from './types';

type LineageSubset = Pick<ParsedLineage, 'datasets' | 'columnLineageEdges'>;

export function buildColumnFieldKey(datasetKey: string, field: string): string {
  return `${datasetKey}::${field}`;
}

export function splitColumnFieldKey(key: string): { datasetKey: string; field: string } {
  const separatorIndex = key.lastIndexOf('::');

  if (separatorIndex === -1) {
    return { datasetKey: key, field: '' };
  }

  return {
    datasetKey: key.slice(0, separatorIndex),
    field: key.slice(separatorIndex + 2),
  };
}

export function computeColumnFieldLineageStatus(
  data: LineageSubset,
): Record<string, ColumnFieldLineageStatus> {
  const datasetRoleByKey = new Map<string, ParsedLineage['datasets'][number]['role']>();
  const incomingByField = new Map<string, string[]>();
  const sourceFieldKeys = new Set<string>();
  const targetFieldKeys = new Set<string>();
  const allFieldKeys = new Set<string>();

  for (const dataset of data.datasets) {
    const datasetKey = `${dataset.namespace}::${dataset.name}`;
    datasetRoleByKey.set(datasetKey, dataset.role);

    for (const field of dataset.schema) {
      allFieldKeys.add(buildColumnFieldKey(datasetKey, field.name));
    }
  }

  for (const edge of data.columnLineageEdges) {
    const sourceKey = buildColumnFieldKey(edge.sourceDataset, edge.sourceField);
    const targetKey = buildColumnFieldKey(edge.targetDataset, edge.targetField);

    allFieldKeys.add(sourceKey);
    allFieldKeys.add(targetKey);
    sourceFieldKeys.add(sourceKey);
    targetFieldKeys.add(targetKey);

    const existingIncoming = incomingByField.get(targetKey);
    if (existingIncoming) {
      existingIncoming.push(sourceKey);
    } else {
      incomingByField.set(targetKey, [sourceKey]);
    }
  }

  const cache = new Map<string, ColumnFieldLineageStatus>();
  const visiting = new Set<string>();

  const resolveStatus = (fieldKey: string): ColumnFieldLineageStatus => {
    const cached = cache.get(fieldKey);
    if (cached) {
      return cached;
    }

    if (visiting.has(fieldKey)) {
      return 'resolved';
    }

    visiting.add(fieldKey);

    const incoming = incomingByField.get(fieldKey) || [];
    let resolvedStatus: ColumnFieldLineageStatus;

    if (incoming.length === 0) {
      const { datasetKey } = splitColumnFieldKey(fieldKey);
      const role = datasetRoleByKey.get(datasetKey);

      if (role === 'source') {
        resolvedStatus = 'resolved';
      } else if (!role && sourceFieldKeys.has(fieldKey) && !targetFieldKeys.has(fieldKey)) {
        resolvedStatus = 'resolved';
      } else {
        resolvedStatus = 'unfilled';
      }
    } else {
      resolvedStatus = incoming.some((sourceKey) => resolveStatus(sourceKey) === 'resolved')
        ? 'resolved'
        : 'unfilled';
    }

    visiting.delete(fieldKey);
    cache.set(fieldKey, resolvedStatus);
    return resolvedStatus;
  };

  for (const fieldKey of allFieldKeys) {
    resolveStatus(fieldKey);
  }

  return Object.fromEntries(cache);
}