'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { ParsedFieldRule, ParsedLineage } from '@/lib/types';
import { useThemeContext } from '@/components/ThemeProvider';
import MainframeBundlePicker from '@/components/MainframeBundlePicker';
import TableLineage from '@/components/TableLineage';
import ColumnLineage from '@/components/ColumnLineage';
import { formatRawTransformation } from '@/lib/mainframe/transformationCatalog';

interface LoadedBundle {
  id: string;
  label: string;
  data: ParsedLineage;
}

interface ResolvedFieldRule extends ParsedFieldRule {
  inherited: boolean;
  originFieldKey: string;
  upstreamDistance: number;
}

const STORAGE_KEY = 'mainframe-lineage-loaded-bundles-v1';
const SELECTED_JCL_STORAGE_KEY = 'mainframe-lineage-selected-jcl-v1';

export default function MainframePage() {
  const [bundles, setBundles] = useState<LoadedBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedField, setSelectedField] = useState<{ datasetKey: string; field: string } | null>(null);
  const [selectedJcl, setSelectedJcl] = useState('');
  const { isDark } = useThemeContext();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      const rawSelectedJcl = window.localStorage.getItem(SELECTED_JCL_STORAGE_KEY);

      if (rawValue) {
        const parsedBundles = JSON.parse(rawValue) as LoadedBundle[];
        if (Array.isArray(parsedBundles)) {
          setBundles(parsedBundles);
        }
      }

      if (rawSelectedJcl) {
        setSelectedJcl(rawSelectedJcl);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SELECTED_JCL_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!bundles.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundles));
  }, [bundles]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!selectedJcl) {
      window.localStorage.removeItem(SELECTED_JCL_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_JCL_STORAGE_KEY, selectedJcl);
  }, [selectedJcl]);

  const data = useMemo(() => {
    if (!bundles.length) {
      return null;
    }

    return bundles.reduce((acc, bundle) => (acc ? mergeParsedLineage(acc, bundle.data) : bundle.data), null as ParsedLineage | null);
  }, [bundles]);

  const filteredData = useMemo(() => {
    if (!data || !selectedJcl) {
      return data;
    }

    const allowedDatasetKeys = new Set(
      data.datasets
        .filter((dataset) => dataset.jclNames?.includes(selectedJcl))
        .map((dataset) => `${dataset.namespace}::${dataset.name}`),
    );
    const allowedJobs = new Set(
      data.jobs.filter((job) => job.jclName === selectedJcl).map((job) => job.name),
    );

    const datasets = data.datasets.filter((dataset) =>
      allowedDatasetKeys.has(`${dataset.namespace}::${dataset.name}`),
    );
    const jobs = data.jobs.filter((job) => allowedJobs.has(job.name));
    const tableLineageEdges = data.tableLineageEdges.filter(
      (edge) =>
        (allowedDatasetKeys.has(edge.source) || allowedJobs.has(edge.source)) &&
        (allowedDatasetKeys.has(edge.target) || allowedJobs.has(edge.target)),
    );
    const columnLineageEdges = data.columnLineageEdges.filter(
      (edge) =>
        allowedDatasetKeys.has(edge.sourceDataset) &&
        allowedDatasetKeys.has(edge.targetDataset),
    );
    const visibleFieldKeys = new Set(
      datasets.flatMap((dataset) => dataset.schema.map((field) => `${dataset.namespace}::${dataset.name}::${field.name}`)),
    );
    const fieldRules = Object.fromEntries(
      Object.entries(data.fieldRules || {}).filter(([fieldKey]) => visibleFieldKeys.has(fieldKey)),
    );

    return {
      ...data,
      datasets,
      jobs,
      tableLineageEdges,
      columnLineageEdges,
      fieldRules,
      stats: {
        ...data.stats,
        totalJobs: jobs.length,
        totalDatasets: datasets.length,
        columnLineageCount: columnLineageEdges.length,
      },
    };
  }, [data, selectedJcl]);

  useEffect(() => {
    if (!filteredData || !selectedField) {
      return;
    }

    const fieldExists = filteredData.datasets.some(
      (dataset) =>
        `${dataset.namespace}::${dataset.name}` === selectedField.datasetKey &&
        dataset.schema.some((field) => field.name === selectedField.field),
    );

    if (!fieldExists) {
      setSelectedField(null);
    }
  }, [filteredData, selectedField]);

  if (loading) {
    return (
      <CenteredMessage isDark={isDark} title="Carregando bundle canonico" body="Convertendo datasets e campos para o viewer de column lineage..." />
    );
  }

  if (error) {
    return (
      <CenteredMessage
        isDark={isDark}
        title="Falha ao carregar bundle"
        body={error}
        danger
        action={{
          label: 'Tentar novamente',
          onClick: () => {
            setError(null);
            setBundles([]);
            setSelectedField(null);
            setSelectedJcl('');
          },
        }}
      />
    );
  }

  if (!data || !filteredData) {
    return (
      <MainframeBundlePicker
        onDataLoaded={(nextBundles) => {
          setBundles(nextBundles.map(createLoadedBundle));
          setSelectedField(null);
          setSelectedJcl('');
        }}
        onError={setError}
        onLoading={setLoading}
      />
    );
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px 20px' }}>
        <div
          style={{
            backgroundColor: isDark ? '#252423' : '#FFFFFF',
            border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
            borderRadius: '10px',
            padding: '20px 24px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D83B01', marginBottom: '8px' }}>
            Mainframe Lineage
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', color: isDark ? '#FAF9F8' : '#323130' }}>
            Viewer de column lineage a partir do bundle canonico
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: isDark ? '#A19F9D' : '#605E5C', maxWidth: '900px' }}>
            Cada dataset do mainframe foi convertido para o formato visual do Marquito. Clique em qualquer coluna
            para rastrear upstream e downstream, incluindo regras por `db_lookup`, `compute`, `conditional` e
            origens sinteticas de `HARD_CODE`.
          </p>
          <div style={{ marginTop: '14px' }}>
            <MainframeBundlePicker
              compact
              onDataLoaded={(nextBundles) => {
                setBundles((current) =>
                  nextBundles.reduce(
                    (acc, nextData) => addOrReplaceBundle(acc, createLoadedBundle(nextData)),
                    current,
                  ),
                );
              }}
              onError={setError}
              onLoading={setLoading}
            />
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#D2D0CE' : '#605E5C', marginBottom: '8px' }}>
              JCLs carregados ({bundles.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '999px',
                    backgroundColor: selectedJcl === bundle.label ? 'rgba(0,120,212,0.12)' : isDark ? '#323130' : '#F3F2F1',
                    color: selectedJcl === bundle.label ? '#0078D4' : isDark ? '#D2D0CE' : '#605E5C',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedJcl(bundle.label)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    {bundle.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBundles((current) => current.filter((item) => item.id !== bundle.id));
                      setSelectedField(null);
                      setSelectedJcl((current) => (current === bundle.label ? '' : current));
                    }}
                    title={`Remover ${bundle.label}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '14px' }}>
            <label style={{ display: 'grid', gap: '6px', minWidth: '260px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#D2D0CE' : '#605E5C' }}>
                Filtrar por JCL
              </span>
              <select
                value={selectedJcl}
                onChange={(event) => setSelectedJcl(event.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
                  backgroundColor: isDark ? '#201F1E' : '#FFFFFF',
                  color: isDark ? '#FAF9F8' : '#323130',
                  fontSize: '13px',
                }}
              >
                <option value="">Todos os JCLs</option>
                {(data.jclNames || []).map((jclName) => (
                  <option key={jclName} value={jclName}>
                    {jclName}
                  </option>
                ))}
              </select>
            </label>
            {selectedJcl ? (
              <button
                type="button"
                onClick={() => setSelectedJcl('')}
                style={{
                  marginTop: '18px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
                  backgroundColor: isDark ? '#252423' : '#FFFFFF',
                  color: isDark ? '#D2D0CE' : '#605E5C',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Limpar filtro
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void exportStaticSite(bundles, selectedJcl);
              }}
              style={{
                marginTop: '18px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0078D4',
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Exportar site estatico
            </button>
            <button
              type="button"
              onClick={() => {
                setBundles([]);
                setSelectedField(null);
                setSelectedJcl('');
              }}
              style={{
                marginTop: '18px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#484644' : '#C8C6C4'}`,
                backgroundColor: isDark ? '#252423' : '#FFFFFF',
                color: isDark ? '#D2D0CE' : '#605E5C',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Limpar bundles
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
            <SummaryPill label="Datasets" value={String(filteredData.stats.totalDatasets)} />
            <SummaryPill label="Steps" value={String(filteredData.stats.totalJobs)} />
            <SummaryPill label="Table edges" value={String(filteredData.tableLineageEdges.length)} />
            <SummaryPill label="Column edges" value={String(filteredData.stats.columnLineageCount)} />
            <SummaryPill label="Artifacts" value={String(filteredData.artifacts?.length || 0)} />
            <SummaryPill label="JCL ativo" value={selectedJcl || 'Todos'} />
          </div>
        </div>
      </section>

      <TableLineage data={filteredData} />
      <ColumnLineage data={filteredData} onSelectionChange={setSelectedField} />
      <MainframeRulePanel
        isDark={isDark}
        selectedField={selectedField}
        rules={resolveFieldRules(filteredData, selectedField)}
      />
    </div>
  );
}

function resolveFieldRules(
  data: ParsedLineage,
  selectedField: { datasetKey: string; field: string } | null,
): ResolvedFieldRule[] {
  if (!selectedField || !data.fieldRules) {
    return [];
  }

  const selectedFieldKey = `${selectedField.datasetKey}::${selectedField.field}`;
  const inboundEdges = new Map<string, Array<{ sourceFieldKey: string }>>();

  data.columnLineageEdges.forEach((edge) => {
    const targetFieldKey = `${edge.targetDataset}::${edge.targetField}`;
    const sourceFieldKey = `${edge.sourceDataset}::${edge.sourceField}`;
    const existingEdges = inboundEdges.get(targetFieldKey) || [];
    existingEdges.push({ sourceFieldKey });
    inboundEdges.set(targetFieldKey, existingEdges);
  });

  const queue = [{ fieldKey: selectedFieldKey, distance: 0 }];
  const visited = new Set<string>();
  const collectedRules = new Map<string, ResolvedFieldRule>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current.fieldKey)) {
      continue;
    }

    visited.add(current.fieldKey);

    (data.fieldRules[current.fieldKey] || []).forEach((rule) => {
      const dedupeKey = `${rule.ruleId}::${rule.stepId}::${rule.expression}`;
      const resolvedRule: ResolvedFieldRule = {
        ...rule,
        inherited: current.fieldKey !== selectedFieldKey,
        originFieldKey: current.fieldKey,
        upstreamDistance: current.distance,
      };
      const existingRule = collectedRules.get(dedupeKey);

      if (
        !existingRule ||
        resolvedRule.upstreamDistance < existingRule.upstreamDistance ||
        (resolvedRule.upstreamDistance === existingRule.upstreamDistance && !resolvedRule.inherited && existingRule.inherited)
      ) {
        collectedRules.set(dedupeKey, resolvedRule);
      }
    });

    (inboundEdges.get(current.fieldKey) || []).forEach((edge) => {
      if (!visited.has(edge.sourceFieldKey)) {
        queue.push({ fieldKey: edge.sourceFieldKey, distance: current.distance + 1 });
      }
    });
  }

  return Array.from(collectedRules.values()).sort((left, right) => {
    if (left.inherited !== right.inherited) {
      return left.inherited ? 1 : -1;
    }
    if (left.upstreamDistance !== right.upstreamDistance) {
      return left.upstreamDistance - right.upstreamDistance;
    }
    const leftStep = left.stepName || left.stepId || '';
    const rightStep = right.stepName || right.stepId || '';
    const stepCompare = leftStep.localeCompare(rightStep);
    if (stepCompare !== 0) {
      return stepCompare;
    }
    return left.ruleId.localeCompare(right.ruleId);
  });
}

function formatFieldKey(fieldKey: string): string {
  const parts = fieldKey.split('::');
  if (parts.length < 3) {
    return fieldKey;
  }

  return `${parts.slice(0, 2).join('::')} :: ${parts.slice(2).join('::')}`;
}

function MainframeRulePanel({
  isDark,
  selectedField,
  rules,
}: {
  isDark: boolean;
  selectedField: { datasetKey: string; field: string } | null;
  rules: ResolvedFieldRule[];
}) {
  return (
    <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px 32px' }}>
      <div
        style={{
          backgroundColor: isDark ? '#252423' : '#FFFFFF',
          border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
          borderRadius: '10px',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: isDark ? '#FAF9F8' : '#323130' }}>
            Regras do campo
          </h2>
          <div style={{ fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C' }}>
            {selectedField ? `${selectedField.datasetKey} :: ${selectedField.field}` : 'Nenhum campo selecionado'}
          </div>
        </div>

        {!selectedField ? (
          <div style={{ fontSize: '14px', color: isDark ? '#A19F9D' : '#605E5C' }}>
            Clique em um campo no Column-Level Lineage para ver as regras associadas.
          </div>
        ) : !rules.length ? (
          <div style={{ fontSize: '14px', color: isDark ? '#A19F9D' : '#605E5C' }}>
            Este campo nao possui regras explicitas nem regras herdadas pelo lineage upstream.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
            {rules.map((rule) => (
              <article
                key={`${rule.ruleId}-${rule.stepId}`}
                style={{
                  border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  backgroundColor: isDark ? '#201F1E' : '#FAF9F8',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <RuleBadge isDark={isDark} label={rule.ruleId} strong />
                  <RuleBadge isDark={isDark} label={rule.stepId || 'UNKNOWN'} />
                  {rule.standardTransformationLabel ? <RuleBadge isDark={isDark} label={rule.standardTransformationLabel} accent /> : null}
                  <RuleBadge isDark={isDark} label={formatRawTransformation(rule.ruleType, rule.ruleSubtype)} />
                  {rule.stepName ? <RuleBadge isDark={isDark} label={rule.stepName} /> : null}
                  {rule.programName ? <RuleBadge isDark={isDark} label={rule.programName} /> : null}
                  {rule.inherited ? <RuleBadge isDark={isDark} label={`Herdada (${rule.upstreamDistance})`} accent /> : null}
                </div>
                {rule.inherited ? (
                  <div style={{ fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C', marginBottom: '8px' }}>
                    Origem upstream: {formatFieldKey(rule.originFieldKey)}
                  </div>
                ) : null}
                <div style={{ fontSize: '13px', color: isDark ? '#FAF9F8' : '#323130', fontFamily: 'monospace', marginBottom: '8px' }}>
                  {rule.expression || 'Sem expressao'}
                </div>
                <div style={{ fontSize: '13px', color: isDark ? '#A19F9D' : '#605E5C', lineHeight: '1.6' }}>
                  {rule.description || 'Sem descricao'}
                </div>
                {rule.evidence?.length ? (
                  <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                    {rule.evidence.map((item) => (
                      <div
                        key={item.evidenceId}
                        style={{
                          borderTop: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
                          paddingTop: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          <RuleBadge isDark={isDark} label={item.relatedType} />
                          <RuleBadge isDark={isDark} label={item.confidence || 'unknown'} />
                          {item.artifact?.name ? <RuleBadge isDark={isDark} label={item.artifact.name} accent /> : null}
                        </div>
                        <div style={{ fontSize: '12px', color: isDark ? '#FAF9F8' : '#323130', fontFamily: 'monospace', marginBottom: '6px' }}>
                          {item.location}
                        </div>
                        <div style={{ fontSize: '13px', color: isDark ? '#A19F9D' : '#605E5C', lineHeight: '1.6' }}>
                          {item.excerpt}
                        </div>
                        {item.artifact ? (
                          <div style={{ fontSize: '12px', color: isDark ? '#A19F9D' : '#605E5C', lineHeight: '1.6', marginTop: '6px' }}>
                            {item.artifact.artifactType} • {item.artifact.path}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RuleBadge({
  isDark,
  label,
  accent = false,
  strong = false,
}: {
  isDark: boolean;
  label: string;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: strong ? 700 : 600,
        padding: '4px 8px',
        borderRadius: '999px',
        backgroundColor: accent
          ? 'rgba(0,120,212,0.12)'
          : isDark ? '#323130' : '#F3F2F1',
        color: accent
          ? '#0078D4'
          : isDark ? '#D2D0CE' : '#605E5C',
      }}
    >
      {label}
    </span>
  );
}

function CenteredMessage({
  isDark,
  title,
  body,
  danger = false,
  action,
}: {
  isDark: boolean;
  title: string;
  body: string;
  danger?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 96px)',
        gap: '12px',
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: 700, color: danger ? '#A4262C' : isDark ? '#FAF9F8' : '#323130' }}>{title}</div>
      <div style={{ fontSize: '14px', color: isDark ? '#A19F9D' : '#605E5C' }}>{body}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: '10px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0078D4',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: '999px',
        backgroundColor: 'rgba(0,120,212,0.08)',
        color: '#0078D4',
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {label}: {value}
    </div>
  );
}

function mergeParsedLineage(current: ParsedLineage, incoming: ParsedLineage): ParsedLineage {
  const datasetsByKey = new Map(current.datasets.map((dataset) => [`${dataset.namespace}::${dataset.name}`, dataset]));
  const jobsByKey = new Map(current.jobs.map((job) => [job.name, job]));
  const tableEdgesByKey = new Map(current.tableLineageEdges.map((edge) => [`${edge.source}->${edge.target}`, edge]));
  const columnEdgesByKey = new Map(
    current.columnLineageEdges.map((edge) => [
      `${edge.sourceDataset}::${edge.sourceField}->${edge.targetDataset}::${edge.targetField}::${edge.transformationType}::${edge.transformationSubtype}`,
      edge,
    ]),
  );
  const artifactsByKey = new Map((current.artifacts || []).map((artifact) => [artifact.artifactId, artifact]));
  const fieldRules = { ...(current.fieldRules || {}) } as NonNullable<ParsedLineage['fieldRules']>;

  for (const dataset of incoming.datasets) {
    const key = `${dataset.namespace}::${dataset.name}`;
    const existing = datasetsByKey.get(key);
    if (!existing) {
      datasetsByKey.set(key, dataset);
      continue;
    }

    datasetsByKey.set(key, {
      ...existing,
      ...dataset,
      schema: dedupeBy(
        [...existing.schema, ...dataset.schema],
        (field) => field.name,
      ).sort((left, right) => left.name.localeCompare(right.name)),
      relatedSteps: dedupeStrings([...(existing.relatedSteps || []), ...(dataset.relatedSteps || [])]),
      relatedPrograms: dedupeStrings([...(existing.relatedPrograms || []), ...(dataset.relatedPrograms || [])]),
      jclNames: dedupeStrings([...(existing.jclNames || []), ...(dataset.jclNames || [])]),
    });
  }

  for (const job of incoming.jobs) {
    jobsByKey.set(job.name, { ...jobsByKey.get(job.name), ...job });
  }

  for (const edge of incoming.tableLineageEdges) {
    tableEdgesByKey.set(`${edge.source}->${edge.target}`, edge);
  }

  for (const edge of incoming.columnLineageEdges) {
    columnEdgesByKey.set(
      `${edge.sourceDataset}::${edge.sourceField}->${edge.targetDataset}::${edge.targetField}::${edge.transformationType}::${edge.transformationSubtype}`,
      edge,
    );
  }

  for (const artifact of incoming.artifacts || []) {
    artifactsByKey.set(artifact.artifactId, artifact);
  }

  for (const [fieldKey, rules] of Object.entries(incoming.fieldRules || {})) {
    fieldRules[fieldKey] = dedupeBy(
      [...(fieldRules[fieldKey] || []), ...rules],
      (rule) => `${rule.ruleId}::${rule.stepId}::${rule.expression}`,
    );
  }

  const datasets = Array.from(datasetsByKey.values());
  const jobs = Array.from(jobsByKey.values());
  const tableLineageEdges = Array.from(tableEdgesByKey.values());
  const columnLineageEdges = Array.from(columnEdgesByKey.values());
  const artifacts = Array.from(artifactsByKey.values());
  const jclNames = dedupeStrings([...(current.jclNames || []), ...(incoming.jclNames || [])]);

  return {
    ...current,
    events: [...current.events, ...incoming.events],
    datasets,
    jobs,
    tableLineageEdges,
    columnLineageEdges,
    fieldRules,
    artifacts,
    jclNames,
    stats: {
      totalEvents: current.stats.totalEvents + incoming.stats.totalEvents,
      totalJobs: jobs.length,
      totalDatasets: datasets.length,
      columnLineageCount: columnLineageEdges.length,
      startEvents: current.stats.startEvents + incoming.stats.startEvents,
      completeEvents: current.stats.completeEvents + incoming.stats.completeEvents,
    },
  };
}

function createLoadedBundle(data: ParsedLineage): LoadedBundle {
  const label = data.jclNames?.[0] || `Bundle ${Date.now()}`;
  return {
    id: `${label}-${Date.now()}`,
    label,
    data,
  };
}

function addOrReplaceBundle(current: LoadedBundle[], incoming: LoadedBundle): LoadedBundle[] {
  const withoutSameLabel = current.filter((bundle) => bundle.label !== incoming.label);
  return [...withoutSameLabel, incoming].sort((left, right) => left.label.localeCompare(right.label));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function dedupeBy<T>(values: T[], keyFn: (value: T) => string): T[] {
  const map = new Map<string, T>();
  values.forEach((value) => {
    map.set(keyFn(value), value);
  });
  return Array.from(map.values());
}

async function exportStaticSite(bundles: LoadedBundle[], selectedJcl: string): Promise<void> {
  const fileName = `mainframe-lineage-site-${selectedJcl || 'all'}-${new Date().toISOString().slice(0, 10)}.zip`;
  const zip = new JSZip();
  const exportedPageHtml = await fetch(`${window.location.origin}/mainframe/`).then(async (response) => {
    if (!response.ok) {
      throw new Error('Falha ao carregar o HTML estatico da rota /mainframe.');
    }

    return response.text();
  });

  const parser = new DOMParser();
  const exportedDocument = parser.parseFromString(exportedPageHtml, 'text/html');
  const head = exportedDocument.querySelector('head');

  if (head) {
    const bootstrapScript = exportedDocument.createElement('script');
    bootstrapScript.textContent = `
      window.localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${safeJsonForScript(JSON.stringify(bundles))});
      ${
        selectedJcl
          ? `window.localStorage.setItem(${JSON.stringify(SELECTED_JCL_STORAGE_KEY)}, ${JSON.stringify(selectedJcl)});`
          : `window.localStorage.removeItem(${JSON.stringify(SELECTED_JCL_STORAGE_KEY)});`
      }
    `;
    head.insertBefore(bootstrapScript, head.firstChild);
  }

  exportedDocument.querySelectorAll('[data-next-badge-root], nextjs-portal').forEach((node) => node.remove());

  const assetUrls = collectAssetUrls(exportedDocument);
  rewriteDocumentAssetPaths(exportedDocument);

  let html = `<!DOCTYPE html>\n${exportedDocument.documentElement.outerHTML}`;
  html = rewriteInlineAssetReferences(html);

  zip.file('index.html', html);

  await Promise.all(
    assetUrls.map(async (assetUrl) => {
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Falha ao exportar asset: ${assetUrl}`);
      }

      const assetPath = toZipAssetPath(assetUrl);
      if (!assetPath) {
        return;
      }

      const fileData = await response.arrayBuffer();
      zip.file(assetPath, fileData);
    }),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

function collectAssetUrls(root: ParentNode): string[] {
  const urls = new Set<string>();

  root.querySelectorAll('script[src], link[href], img[src]').forEach((node) => {
    const element = node as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    const rawUrl = element.getAttribute('src') || element.getAttribute('href');
    if (!rawUrl) {
      return;
    }

    const absoluteUrl = new URL(rawUrl, window.location.href);
    if (absoluteUrl.origin !== window.location.origin) {
      return;
    }

    if (!absoluteUrl.pathname.startsWith('/_next/')) {
      return;
    }

    urls.add(absoluteUrl.toString());
  });

  return Array.from(urls);
}

function rewriteDocumentAssetPaths(root: ParentNode): void {
  root.querySelectorAll('script[src], link[href], img[src]').forEach((node) => {
    const element = node as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    const attrName = element.hasAttribute('src') ? 'src' : 'href';
    const rawUrl = element.getAttribute(attrName);
    if (!rawUrl) {
      return;
    }

    const absoluteUrl = new URL(rawUrl, window.location.href);
    if (absoluteUrl.origin !== window.location.origin) {
      return;
    }

    const assetPath = toZipAssetPath(absoluteUrl.toString());
    if (!assetPath) {
      return;
    }

    element.setAttribute(attrName, `./${assetPath}`);
  });
}

function toZipAssetPath(assetUrl: string): string | null {
  const parsed = new URL(assetUrl, window.location.href);
  if (parsed.origin !== window.location.origin) {
    return null;
  }

  if (!parsed.pathname.startsWith('/_next/')) {
    return null;
  }

  const normalizedPath = parsed.pathname.replace(/^\/+/, '');
  return normalizedPath || null;
}

function rewriteInlineAssetReferences(html: string): string {
  return html
    .replaceAll('"/_next/', '"./_next/')
    .replaceAll("'/_next/", "'./_next/");
}

function safeJsonForScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
