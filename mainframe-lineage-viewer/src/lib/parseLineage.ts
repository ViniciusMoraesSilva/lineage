import {
  OpenLineageEvent,
  ParsedLineage,
  ParsedJob,
  ParsedDataset,
  ColumnLineageEdge,
  SchemaField,
} from './types';

const BLOB_BASE =
  'https://rakirahman.blob.core.windows.net/public/datasets';

export const SAMPLE_DATASETS = [
  {
    id: 'spark-delta',
    label: 'Spark ETL Pipeline',
    description: 'A custom Spark Scala ETL pipeline ingesting 4 CSV sources through Delta Lake tables with column-level lineage.',
    fileName: 'openlineage-from-spark-demo-customer.json',
    localPath: '/openlineage-from-spark-demo-customer.json',
    events: 50,
    color: '#0078D4',
  },
  {
    id: 'dbt-jaffle-shop',
    label: 'dbt Jaffle Shop',
    description: 'The classic dbt jaffle_shop tutorial project — customers, orders, and payments models with staging and mart layers.',
    fileName: 'openlineage-from-spark-dbt-jaffle-shop.json',
    localPath: '/openlineage-from-spark-dbt-jaffle-shop.json',
    events: 90,
    color: '#F2C811',
  },
  {
    id: 'dbt-adventureworks',
    label: 'dbt AdventureWorks',
    description: 'A larger dbt project modeling the AdventureWorks sample database with sales, products, and customer dimensions.',
    fileName: 'openlineage-from-spark-dbt-adventureworks.json',
    localPath: '/openlineage-from-spark-dbt-adventureworks.json',
    events: 232,
    color: '#107C10',
  },
] as const;

export async function fetchLineageData(localPath?: string): Promise<ParsedLineage> {
  const url = localPath || SAMPLE_DATASETS[0].localPath;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const text = await response.text();
  const parsed = parseLineageText(text);

  if (url === SAMPLE_DATASETS[0].localPath) {
    return injectUnfilledFieldSample(parsed);
  }

  return parsed;
}

export function validateJsonl(text: string): { valid: boolean; eventCount: number; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) {
    return { valid: false, eventCount: 0, errors: ['File is empty or contains no valid lines.'] };
  }
  let validCount = 0;
  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      if (!obj.eventType) errors.push(`Line ${i + 1}: Missing "eventType" field.`);
      else if (!obj.job) errors.push(`Line ${i + 1}: Missing "job" field.`);
      else if (!obj.run) errors.push(`Line ${i + 1}: Missing "run" field.`);
      else validCount++;
    } catch {
      errors.push(`Line ${i + 1}: Invalid JSON.`);
    }
    if (errors.length >= 5) {
      errors.push(`... and possibly more errors (stopped after 5).`);
      break;
    }
  }
  return { valid: errors.length === 0, eventCount: validCount, errors };
}

export function parseLineageText(text: string): ParsedLineage {
  const events: OpenLineageEvent[] = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  return parseEvents(events);
}

function shortDatasetName(name: string): string {
  const parts = name.split('/');
  const dbPart = parts.find((p) => p.endsWith('.db'));
  if (dbPart) {
    const idx = parts.indexOf(dbPart);
    return parts.slice(idx).join('/');
  }
  // CSV files
  const lastTwo = parts.slice(-2);
  return lastTwo.join('/');
}

function parseEvents(events: OpenLineageEvent[]): ParsedLineage {
  const jobMap = new Map<string, ParsedJob>();
  const datasetMap = new Map<string, ParsedDataset>();
  const columnLineageEdges: ColumnLineageEdge[] = [];
  const tableEdgeSet = new Set<string>();
  const tableLineageEdges: Array<{ source: string; target: string; job: string }> = [];

  // Sort events by time
  events.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());

  for (const event of events) {
    const jobName = event.job.name;
    const jobFacets = event.job.facets;

    // Skip the parent application job for cleaner visualization
    if (jobFacets?.jobType?.jobType === 'APPLICATION') continue;

    // Collect jobs
    if (!jobMap.has(jobName) || event.eventType === 'COMPLETE') {
      jobMap.set(jobName, {
        name: jobName,
        namespace: event.job.namespace,
        type: jobFacets?.jobType?.jobType || 'UNKNOWN',
        processingType: jobFacets?.jobType?.processingType || 'UNKNOWN',
        integration: jobFacets?.jobType?.integration || 'UNKNOWN',
        latestEventType: event.eventType,
        latestEventTime: event.eventTime,
        sql: jobFacets?.sql?.query,
        runId: event.run.runId,
      });
    }

    // Collect datasets
    for (const input of event.inputs) {
      const key = `${input.namespace}::${input.name}`;
      if (!datasetMap.has(key)) {
        datasetMap.set(key, {
          name: input.name,
          namespace: input.namespace,
          shortName: shortDatasetName(input.name),
          schema: input.facets?.schema?.fields || [],
          role: 'source',
        });
      } else {
        // Upgrade schema if we find a better one
        const existing = datasetMap.get(key)!;
        const newFields = input.facets?.schema?.fields || [];
        if (newFields.length > existing.schema.length) {
          existing.schema = newFields;
        }
      }

      // Table lineage: input → job
      const edgeKey = `${key}→${jobName}`;
      if (!tableEdgeSet.has(edgeKey)) {
        tableEdgeSet.add(edgeKey);
        tableLineageEdges.push({ source: key, target: jobName, job: jobName });
      }
    }

    for (const output of event.outputs) {
      const key = `${output.namespace}::${output.name}`;
      const isAlsoInput = event.inputs.some(
        (i) => i.namespace === output.namespace && i.name === output.name
      );

      if (!datasetMap.has(key)) {
        datasetMap.set(key, {
          name: output.name,
          namespace: output.namespace,
          shortName: shortDatasetName(output.name),
          schema: output.facets?.schema?.fields || [],
          role: isAlsoInput ? 'intermediate' : 'target',
          columnLineage: output.facets?.columnLineage?.fields,
        });
      } else {
        const existing = datasetMap.get(key)!;
        const newFields = output.facets?.schema?.fields || [];
        if (newFields.length > existing.schema.length) {
          existing.schema = newFields;
        }
        if (output.facets?.columnLineage?.fields) {
          existing.columnLineage = output.facets.columnLineage.fields;
        }
        if (existing.role === 'source') {
          existing.role = 'intermediate';
        }
      }

      // Table lineage: job → output
      const edgeKey = `${jobName}→${key}`;
      if (!tableEdgeSet.has(edgeKey)) {
        tableEdgeSet.add(edgeKey);
        tableLineageEdges.push({ source: jobName, target: key, job: jobName });
      }

      // Column lineage
      if (output.facets?.columnLineage?.fields) {
        for (const [fieldName, fieldInfo] of Object.entries(output.facets.columnLineage.fields)) {
          for (const inputField of fieldInfo.inputFields) {
            const srcKey = `${inputField.namespace}::${inputField.name}`;
            columnLineageEdges.push({
              sourceDataset: srcKey,
              sourceField: inputField.field,
              targetDataset: key,
              targetField: fieldName,
              transformationType: inputField.transformations?.[0]?.type || 'UNKNOWN',
              transformationSubtype: inputField.transformations?.[0]?.subtype || 'UNKNOWN',
            });
          }
        }
      }
    }
  }

  // Determine dataset roles more accurately
  const outputKeys = new Set<string>();
  const inputKeys = new Set<string>();
  for (const edge of tableLineageEdges) {
    if (edge.source.includes('::')) inputKeys.add(edge.source);
    if (edge.target.includes('::')) outputKeys.add(edge.target);
  }

  for (const [key, ds] of datasetMap) {
    const isInput = inputKeys.has(key);
    const isOutput = outputKeys.has(key);
    if (isInput && isOutput) ds.role = 'intermediate';
    else if (isOutput && !isInput) {
      // Check if it's also used as input somewhere else
      const usedAsInput = tableLineageEdges.some((e) => e.source === key);
      ds.role = usedAsInput ? 'intermediate' : 'target';
    } else if (isInput && !isOutput) {
      ds.role = 'source';
    }
  }

  const jobs = Array.from(jobMap.values());
  const datasets = Array.from(datasetMap.values());

  return {
    events,
    jobs,
    datasets,
    columnLineageEdges,
    tableLineageEdges,
    stats: {
      totalEvents: events.length,
      totalJobs: jobs.length,
      totalDatasets: datasets.length,
      columnLineageCount: columnLineageEdges.length,
      startEvents: events.filter((e) => e.eventType === 'START').length,
      completeEvents: events.filter((e) => e.eventType === 'COMPLETE').length,
    },
  };
}

export function injectUnfilledFieldSample(data: ParsedLineage): ParsedLineage {
  const persistentDemoField = 'Demo_Laranja_Persistente';
  const recoveredDemoField = 'Demo_Laranja_Vira_Azul';

  if (data.datasets.some((dataset) => dataset.schema.some((field) => field.name === persistentDemoField))) {
    return data;
  }

  const datasetByKey = new Map(
    data.datasets.map((dataset) => [`${dataset.namespace}::${dataset.name}`, dataset] as const),
  );
  const adjacency = new Map<string, Set<string>>();

  for (const edge of data.columnLineageEdges) {
    if (edge.sourceDataset === edge.targetDataset) {
      continue;
    }

    if (!adjacency.has(edge.sourceDataset)) {
      adjacency.set(edge.sourceDataset, new Set());
    }

    adjacency.get(edge.sourceDataset)?.add(edge.targetDataset);
  }

  const findDatasetKeyBySuffix = (suffix: string) =>
    data.datasets.find((dataset) => dataset.name.endsWith(suffix))
      ? `${data.datasets.find((dataset) => dataset.name.endsWith(suffix))?.namespace}::${data.datasets.find((dataset) => dataset.name.endsWith(suffix))?.name}`
      : null;

  let middleDatasetKey: string | null = findDatasetKeyBySuffix('/products_enriched');
  let downstreamDatasetKey: string | null = findDatasetKeyBySuffix('/sales_enriched');
  let resolvedDatasetKey: string | null = findDatasetKeyBySuffix('/customer_lifetime_value');

  const preferredChainIsValid =
    middleDatasetKey &&
    downstreamDatasetKey &&
    data.columnLineageEdges.some(
      (edge) => edge.sourceDataset === middleDatasetKey && edge.targetDataset === downstreamDatasetKey,
    );

  if (!preferredChainIsValid) {
    middleDatasetKey = null;
    downstreamDatasetKey = null;
    resolvedDatasetKey = null;
  }

  if (!middleDatasetKey || !downstreamDatasetKey) {
    for (const [, middleCandidates] of adjacency) {
      for (const middleCandidate of middleCandidates) {
        const downstreamCandidates = adjacency.get(middleCandidate);
        if (!downstreamCandidates || downstreamCandidates.size === 0) {
          continue;
        }

        for (const downstreamCandidate of downstreamCandidates) {
          if (downstreamCandidate !== middleCandidate) {
            const resolvedCandidates = adjacency.get(downstreamCandidate);

            if (resolvedCandidates) {
              for (const resolvedCandidate of resolvedCandidates) {
                if (resolvedCandidate !== downstreamCandidate && resolvedCandidate !== middleCandidate) {
                  middleDatasetKey = middleCandidate;
                  downstreamDatasetKey = downstreamCandidate;
                  resolvedDatasetKey = resolvedCandidate;
                  break;
                }
              }
            }

            if (!middleDatasetKey || !downstreamDatasetKey) {
              middleDatasetKey = middleCandidate;
              downstreamDatasetKey = downstreamCandidate;
            }

            if (resolvedDatasetKey) {
              break;
            }
          }
        }

        if (middleDatasetKey && downstreamDatasetKey) {
          break;
        }
      }

      if (middleDatasetKey && downstreamDatasetKey) {
        break;
      }
    }
  }

  if (!middleDatasetKey || !downstreamDatasetKey) {
    return data;
  }

  const middleDataset = datasetByKey.get(middleDatasetKey);
  const downstreamDataset = datasetByKey.get(downstreamDatasetKey);
  const resolvedDataset = resolvedDatasetKey ? datasetByKey.get(resolvedDatasetKey) : null;

  const fallbackSourceDataset = data.datasets.find((dataset) => {
    const datasetKey = `${dataset.namespace}::${dataset.name}`;
    return dataset.role === 'source' && datasetKey !== middleDatasetKey && datasetKey !== downstreamDatasetKey;
  });

  if (!middleDataset || !downstreamDataset) {
    return data;
  }

  const datasets = data.datasets.map((dataset) => {
    const datasetKey = `${dataset.namespace}::${dataset.name}`;

    if (
      datasetKey !== middleDatasetKey &&
      datasetKey !== downstreamDatasetKey &&
      datasetKey !== resolvedDatasetKey &&
      datasetKey !== (fallbackSourceDataset ? `${fallbackSourceDataset.namespace}::${fallbackSourceDataset.name}` : null)
    ) {
      return dataset;
    }

    const schema = dataset.schema.some(
      (field) => field.name === persistentDemoField || field.name === recoveredDemoField,
    )
      ? dataset.schema
      : [
        ...dataset.schema,
        {
          name: persistentDemoField,
          type: 'string',
          description: datasetKey === middleDatasetKey
            ? 'Campo criado localmente para demonstrar ausencia de upstream.'
            : 'Campo herdado de um dataset intermediario sem upstream preenchido.',
        },
        {
          name: recoveredDemoField,
          type: 'string',
          description: datasetKey === middleDatasetKey
            ? 'Campo criado localmente para demonstrar retorno ao estado preenchido.'
            : datasetKey === resolvedDatasetKey
              ? 'Campo que volta a ter upstream real apos enriquecimento.'
              : 'Campo propagado a jusante antes de voltar a ficar preenchido.',
        },
      ];

    if (fallbackSourceDataset && datasetKey === `${fallbackSourceDataset.namespace}::${fallbackSourceDataset.name}`) {
      return {
        ...dataset,
        schema: dataset.schema.some((field) => field.name === recoveredDemoField)
          ? dataset.schema
          : [
            ...dataset.schema,
            {
              name: recoveredDemoField,
              type: 'string',
              description: 'Origem real usada para sobrescrever o campo demonstrativo.',
            },
          ],
      };
    }

    if (datasetKey !== downstreamDatasetKey && datasetKey !== resolvedDatasetKey) {
      return {
        ...dataset,
        schema,
      };
    }

    const columnLineage = {
      ...(dataset.columnLineage || {}),
      [persistentDemoField]: {
        inputFields: [
          {
            namespace: middleDataset.namespace,
            name: middleDataset.name,
            field: persistentDemoField,
          },
        ],
        transformationType: 'DIRECT',
        transformationDescription: 'Demonstracao de propagacao de campo sem upstream.',
      },
      [recoveredDemoField]: {
        inputFields: [
          {
            namespace: datasetKey === downstreamDatasetKey ? middleDataset.namespace : downstreamDataset.namespace,
            name: datasetKey === downstreamDatasetKey ? middleDataset.name : downstreamDataset.name,
            field: recoveredDemoField,
          },
          ...(((datasetKey === resolvedDatasetKey) || (datasetKey === downstreamDatasetKey && !resolvedDatasetKey)) && fallbackSourceDataset
            ? [
              {
                namespace: fallbackSourceDataset.namespace,
                name: fallbackSourceDataset.name,
                field: recoveredDemoField,
              },
            ]
            : []),
        ],
        transformationType: datasetKey === resolvedDatasetKey ? 'LOOKUP' : 'DIRECT',
        transformationDescription: datasetKey === resolvedDatasetKey
          ? 'Demonstracao de recuperacao do campo com upstream real.'
          : 'Demonstracao de propagacao do campo antes da recuperacao.',
      },
    };

    return {
      ...dataset,
      schema,
      columnLineage,
    };
  });

  const columnLineageEdges = [
    ...data.columnLineageEdges,
    {
      sourceDataset: middleDatasetKey,
      sourceField: persistentDemoField,
      targetDataset: downstreamDatasetKey,
      targetField: persistentDemoField,
      transformationType: 'DIRECT',
      transformationSubtype: 'IDENTITY',
      standardTransformationKey: 'copia_identidade',
      standardTransformationLabel: 'Copia de identidade',
    },
    {
      sourceDataset: middleDatasetKey,
      sourceField: recoveredDemoField,
      targetDataset: downstreamDatasetKey,
      targetField: recoveredDemoField,
      transformationType: 'DIRECT',
      transformationSubtype: 'IDENTITY',
      standardTransformationKey: 'copia_identidade',
      standardTransformationLabel: 'Copia de identidade',
    },
    ...(!resolvedDatasetKey && fallbackSourceDataset
      ? [
        {
          sourceDataset: `${fallbackSourceDataset.namespace}::${fallbackSourceDataset.name}`,
          sourceField: recoveredDemoField,
          targetDataset: downstreamDatasetKey,
          targetField: recoveredDemoField,
          transformationType: 'LOOKUP',
          transformationSubtype: 'TRANSFORMATION',
          standardTransformationKey: 'busca_valor',
          standardTransformationLabel: 'Busca de valor',
        },
      ]
      : []),
    ...(resolvedDatasetKey
      ? [
        {
          sourceDataset: downstreamDatasetKey,
          sourceField: recoveredDemoField,
          targetDataset: resolvedDatasetKey,
          targetField: recoveredDemoField,
          transformationType: 'DIRECT',
          transformationSubtype: 'IDENTITY',
          standardTransformationKey: 'copia_identidade',
          standardTransformationLabel: 'Copia de identidade',
        },
        ...(fallbackSourceDataset
          ? [
            {
              sourceDataset: `${fallbackSourceDataset.namespace}::${fallbackSourceDataset.name}`,
              sourceField: recoveredDemoField,
              targetDataset: resolvedDatasetKey,
              targetField: recoveredDemoField,
              transformationType: 'LOOKUP',
              transformationSubtype: 'TRANSFORMATION',
              standardTransformationKey: 'busca_valor',
              standardTransformationLabel: 'Busca de valor',
            },
          ]
          : []),
      ]
      : []),
  ];

  return {
    ...data,
    datasets,
    columnLineageEdges,
    stats: {
      ...data.stats,
      columnLineageCount: columnLineageEdges.length,
    },
  };
}
