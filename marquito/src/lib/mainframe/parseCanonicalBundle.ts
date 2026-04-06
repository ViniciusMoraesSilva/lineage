import {
  ParsedDataset,
  ParsedJob,
  ParsedLineage,
  SchemaField,
  ColumnLineageEdge,
  ParsedFieldRule,
  ParsedArtifact,
  ParsedEvidence,
} from '@/lib/types';
import { normalizeMainframeTransformation } from '@/lib/mainframe/transformationCatalog';

type CsvRecord = Record<string, string>;

export interface CanonicalBundleFiles {
  entities: string;
  entityColumns: string;
  columnMappings: string;
  transformRules: string;
  steps?: string;
  artifacts?: string;
  evidence?: string;
}

interface CanonicalEntity {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  system: string;
  notes: string;
}

interface CanonicalColumn {
  entity_id: string;
  column_name: string;
  data_type: string;
  length: string;
  scale: string;
  source_definition: string;
}

interface CanonicalMapping {
  mapping_id: string;
  step_id: string;
  source_entity_id: string;
  source_column_name: string;
  target_entity_id: string;
  target_column_name: string;
  rule_id: string;
  expression: string;
}

interface CanonicalRule {
  rule_id: string;
  step_id: string;
  rule_type: string;
  rule_subtype: string;
  target_entity_id: string;
  target_column_name: string;
  expression: string;
  description: string;
}

interface CanonicalStep {
  step_id: string;
  job_id: string;
  step_name: string;
  sequence: string;
  program_name: string;
  step_type: string;
  jcl_program: string;
  plan_name: string;
  input_ddnames: string;
  output_ddnames: string;
}

interface CanonicalArtifact {
  artifact_id: string;
  artifact_type: string;
  name: string;
  path: string;
  role: string;
  notes: string;
}

interface CanonicalEvidence {
  evidence_id: string;
  related_type: string;
  related_id: string;
  artifact_id: string;
  location: string;
  excerpt: string;
  confidence: string;
}

export function parseCanonicalBundle(files: CanonicalBundleFiles): ParsedLineage {
  const entities = parseCsv(files.entities).map((record) => ({
    entity_id: record.entity_id || '',
    entity_name: record.entity_name || '',
    entity_type: record.entity_type || '',
    system: record.system || '',
    notes: record.notes || '',
  }));
  const entityColumns = parseCsv(files.entityColumns).map((record) => ({
    entity_id: record.entity_id || '',
    column_name: record.column_name || '',
    data_type: record.data_type || '',
    length: record.length || '',
    scale: record.scale || '',
    source_definition: record.source_definition || '',
  }));
  const columnMappings = parseCsv(files.columnMappings).map((record) => ({
    mapping_id: record.mapping_id || '',
    step_id: record.step_id || '',
    source_entity_id: record.source_entity_id || '',
    source_column_name: record.source_column_name || '',
    target_entity_id: record.target_entity_id || '',
    target_column_name: record.target_column_name || '',
    rule_id: record.rule_id || '',
    expression: record.expression || '',
  }));
  const transformRules = parseCsv(files.transformRules).map((record) => ({
    rule_id: record.rule_id || '',
    step_id: record.step_id || '',
    rule_type: record.rule_type || '',
    rule_subtype: record.rule_subtype || '',
    target_entity_id: record.target_entity_id || '',
    target_column_name: record.target_column_name || '',
    expression: record.expression || '',
    description: record.description || '',
  }));
  const steps = parseCsv(files.steps || '').map((record) => ({
    step_id: record.step_id || '',
    job_id: record.job_id || '',
    step_name: record.step_name || '',
    sequence: record.sequence || '',
    program_name: record.program_name || '',
    step_type: record.step_type || '',
    jcl_program: record.jcl_program || '',
    plan_name: record.plan_name || '',
    input_ddnames: record.input_ddnames || '',
    output_ddnames: record.output_ddnames || '',
  }));
  const artifacts = parseCsv(files.artifacts || '').map((record) => ({
    artifact_id: record.artifact_id || '',
    artifact_type: record.artifact_type || '',
    name: record.name || '',
    path: record.path || '',
    role: record.role || '',
    notes: record.notes || '',
  }));
  const evidence = parseCsv(files.evidence || '').map((record) => ({
    evidence_id: record.evidence_id || '',
    related_type: record.related_type || '',
    related_id: record.related_id || '',
    artifact_id: record.artifact_id || '',
    location: record.location || '',
    excerpt: record.excerpt || '',
    confidence: record.confidence || '',
  }));

  const entityById = new Map<string, CanonicalEntity>();
  entities.forEach((entity) => entityById.set(entity.entity_id, entity));

  const schemaByEntityId = new Map<string, SchemaField[]>();
  entityColumns.forEach((column) => {
    if (!schemaByEntityId.has(column.entity_id)) {
      schemaByEntityId.set(column.entity_id, []);
    }
    schemaByEntityId.get(column.entity_id)?.push({
      name: column.column_name,
      type: buildFieldType(column),
      description: column.source_definition,
    });
  });

  const ruleById = new Map<string, CanonicalRule>();
  transformRules.forEach((rule) => ruleById.set(rule.rule_id, rule));

  const datasetsMap = new Map<string, ParsedDataset>();
  const datasetInputs = new Set<string>();
  const datasetOutputs = new Set<string>();
  const columnLineageEdgeMap = new Map<string, ColumnLineageEdge>();
  const stepJobs = new Map<string, ParsedJob>();
  const tableEdgeSet = new Set<string>();
  const tableLineageEdges: Array<{ source: string; target: string; job: string }> = [];
  const fieldRulesMap = new Map<string, ParsedFieldRule[]>();
  const stepById = new Map<string, CanonicalStep>(steps.map((step) => [step.step_id, step]));
  const artifactsById = new Map<string, ParsedArtifact>(
    artifacts.map((artifact) => [
      artifact.artifact_id,
      {
        artifactId: artifact.artifact_id,
        artifactType: artifact.artifact_type,
        name: artifact.name,
        path: artifact.path,
        role: artifact.role,
        notes: artifact.notes,
      },
    ]),
  );
  const evidenceByRelated = new Map<string, ParsedEvidence[]>();
  const jobControlArtifacts = Array.from(artifactsById.values()).filter((artifact) => artifact.role === 'job_control');
  const knownJclNames = resolveBundleJclNames(jobControlArtifacts, steps);

  evidence.forEach((item) => {
    const parsedEvidence: ParsedEvidence = {
      evidenceId: item.evidence_id,
      relatedType: item.related_type,
      relatedId: item.related_id,
      artifactId: item.artifact_id,
      location: item.location,
      excerpt: item.excerpt,
      confidence: item.confidence,
      artifact: artifactsById.get(item.artifact_id),
    };
    const key = `${item.related_type}::${item.related_id}`;
    if (!evidenceByRelated.has(key)) {
      evidenceByRelated.set(key, []);
    }
    evidenceByRelated.get(key)?.push(parsedEvidence);
  });

  function ensureDataset(entityId: string, fallback?: Partial<CanonicalEntity>): ParsedDataset {
    const entity = entityById.get(entityId) || {
      entity_id: entityId,
      entity_name: fallback?.entity_name || entityId,
      entity_type: fallback?.entity_type || 'synthetic',
      system: fallback?.system || 'synthetic',
      notes: fallback?.notes || '',
    };
    const key = datasetKey(entity);

    if (!datasetsMap.has(key)) {
      datasetsMap.set(key, {
        name: entity.entity_name,
        namespace: normalizeNamespace(entity.system),
        shortName: entity.entity_name,
        schema: (schemaByEntityId.get(entity.entity_id) || []).slice(),
        role: 'intermediate',
        system: entity.system,
        entityType: entity.entity_type,
        relatedSteps: [],
        relatedPrograms: [],
        jclNames: [],
      });
    }

    return datasetsMap.get(key)!;
  }

  function addDatasetContext(dataset: ParsedDataset, stepId: string): void {
    const step = stepById.get(stepId);
    const stepName = step?.step_name || stepId;
    const programName = step?.program_name || step?.jcl_program;
    const jclName = resolveCanonicalJclName(step, knownJclNames);

    if (stepName) {
      dataset.relatedSteps = addUnique(dataset.relatedSteps, stepName);
    }
    if (programName) {
      dataset.relatedPrograms = addUnique(dataset.relatedPrograms, programName);
    }
    if (jclName) {
      dataset.jclNames = addUnique(dataset.jclNames, jclName);
    }
  }

  columnMappings.forEach((mapping) => {
    const sourceEntity = entityById.get(mapping.source_entity_id);
    const targetEntity = entityById.get(mapping.target_entity_id);
    if (!sourceEntity || !targetEntity) {
      return;
    }

    const sourceDataset = ensureDataset(sourceEntity.entity_id);
    const targetDataset = ensureDataset(targetEntity.entity_id);
    const rule = ruleById.get(mapping.rule_id);

    const sourceKey = `${sourceDataset.namespace}::${sourceDataset.name}`;
    const targetKey = `${targetDataset.namespace}::${targetDataset.name}`;
    const stepId = mapping.step_id || rule?.step_id || 'UNKNOWN';

    datasetInputs.add(sourceKey);
    datasetOutputs.add(targetKey);
    addDatasetContext(sourceDataset, stepId);
    addDatasetContext(targetDataset, stepId);

    addColumnLineageEdge(columnLineageEdgeMap, {
      sourceDataset: sourceKey,
      sourceField: mapping.source_column_name,
      targetDataset: targetKey,
      targetField: mapping.target_column_name,
      transformationType: rule?.rule_type || 'copy',
      transformationSubtype: rule?.rule_subtype || 'direct',
      standardTransformationKey: normalizeMainframeTransformation(
        rule?.rule_type || 'copy',
        rule?.rule_subtype || 'direct',
      ).key,
      standardTransformationLabel: normalizeMainframeTransformation(
        rule?.rule_type || 'copy',
        rule?.rule_subtype || 'direct',
      ).label,
      stepId,
      stepName: stepById.get(stepId)?.step_name,
    });

    const stepJobKey = ensureStepJob(stepJobs, stepById, knownJclNames, stepId);
    addTableLineageEdge(tableEdgeSet, tableLineageEdges, sourceKey, stepJobKey, stepJobKey);
    addTableLineageEdge(tableEdgeSet, tableLineageEdges, stepJobKey, targetKey, stepJobKey);
  });

  transformRules
    .forEach((rule) => {
      const targetEntity = entityById.get(rule.target_entity_id);
      if (!targetEntity || !rule.target_column_name || rule.target_column_name === '*') {
        return;
      }

      const dataset = ensureDataset(targetEntity.entity_id);
      addDatasetContext(dataset, rule.step_id);
      const fieldKey = `${dataset.namespace}::${dataset.name}::${rule.target_column_name}`;
      if (!fieldRulesMap.has(fieldKey)) {
        fieldRulesMap.set(fieldKey, []);
      }
      const step = stepById.get(rule.step_id);
      const ruleEvidence = [
        ...(evidenceByRelated.get(`rule::${rule.rule_id}`) || []),
        ...(evidenceByRelated.get(`step::${rule.step_id}`) || []),
      ];
      fieldRulesMap.get(fieldKey)?.push({
        ruleId: rule.rule_id,
        stepId: rule.step_id,
        ruleType: rule.rule_type,
        ruleSubtype: rule.rule_subtype,
        standardTransformationKey: normalizeMainframeTransformation(
          rule.rule_type,
          rule.rule_subtype,
        ).key,
        standardTransformationLabel: normalizeMainframeTransformation(
          rule.rule_type,
          rule.rule_subtype,
        ).label,
        expression: rule.expression,
        description: rule.description,
        stepName: step?.step_name,
        programName: step?.program_name || step?.jcl_program,
        stepType: step?.step_type,
        planName: step?.plan_name,
        evidence: ruleEvidence,
      });
    });

  transformRules
    .filter((rule) => rule.rule_type === 'constant' || rule.rule_subtype === 'literal')
    .forEach((rule) => {
      const targetEntity = entityById.get(rule.target_entity_id);
      if (!targetEntity) {
        return;
      }

      const hardCodeDataset = ensureDataset('SYNTHETIC_HARD_CODE', {
        entity_name: 'HARD_CODE',
        entity_type: 'synthetic',
        system: 'hardcode',
        notes: 'Origem sintetica para regras constant/literal',
      });

      const targetDataset = ensureDataset(targetEntity.entity_id);
      const sourceField = extractLiteral(rule.expression) || `literal_${rule.rule_id}`;
      const sourceKey = `${hardCodeDataset.namespace}::${hardCodeDataset.name}`;
      const targetKey = `${targetDataset.namespace}::${targetDataset.name}`;
      const stepId = rule.step_id || 'UNKNOWN';

      if (!hardCodeDataset.schema.some((field) => field.name === sourceField)) {
        hardCodeDataset.schema.push({
          name: sourceField,
          type: 'LITERAL',
          description: rule.expression,
        });
      }

      datasetInputs.add(sourceKey);
      datasetOutputs.add(targetKey);
      addDatasetContext(hardCodeDataset, stepId);
      addDatasetContext(targetDataset, stepId);

      addColumnLineageEdge(columnLineageEdgeMap, {
        sourceDataset: sourceKey,
        sourceField,
        targetDataset: targetKey,
        targetField: rule.target_column_name,
        transformationType: rule.rule_type,
        transformationSubtype: rule.rule_subtype || 'literal',
        standardTransformationKey: normalizeMainframeTransformation(
          rule.rule_type,
          rule.rule_subtype || 'literal',
        ).key,
        standardTransformationLabel: normalizeMainframeTransformation(
          rule.rule_type,
          rule.rule_subtype || 'literal',
        ).label,
        stepId,
        stepName: stepById.get(stepId)?.step_name,
      });

      const stepJobKey = ensureStepJob(stepJobs, stepById, knownJclNames, stepId);
      addTableLineageEdge(tableEdgeSet, tableLineageEdges, sourceKey, stepJobKey, stepJobKey);
      addTableLineageEdge(tableEdgeSet, tableLineageEdges, stepJobKey, targetKey, stepJobKey);
    });

  const columnLineageEdges = Array.from(columnLineageEdgeMap.values());

  const datasets = Array.from(datasetsMap.values()).map((dataset) => {
    const key = `${dataset.namespace}::${dataset.name}`;
    const isInput = datasetInputs.has(key);
    const isOutput = datasetOutputs.has(key);

    if (isInput && isOutput) {
      dataset.role = 'intermediate';
    } else if (isInput) {
      dataset.role = 'source';
    } else if (isOutput) {
      dataset.role = 'target';
    } else {
      dataset.role = 'intermediate';
    }

    dataset.schema.sort((left, right) => left.name.localeCompare(right.name));
    dataset.relatedSteps = Array.from(new Set(dataset.relatedSteps || []));
    dataset.relatedPrograms = Array.from(new Set(dataset.relatedPrograms || []));
    dataset.jclNames = Array.from(new Set(dataset.jclNames || []));
    return dataset;
  });

  return {
    events: [],
    jobs: Array.from(stepJobs.values()),
    datasets,
    columnLineageEdges,
    tableLineageEdges,
    fieldRules: Object.fromEntries(fieldRulesMap),
    artifacts: Array.from(artifactsById.values()),
    jclNames: knownJclNames,
    stats: {
      totalEvents: 0,
      totalJobs: stepJobs.size,
      totalDatasets: datasets.length,
      columnLineageCount: columnLineageEdges.length,
      startEvents: 0,
      completeEvents: 0,
    },
  };
}

function addColumnLineageEdge(
  edgeMap: Map<string, ColumnLineageEdge>,
  edge: ColumnLineageEdge,
): void {
  const key = [
    edge.sourceDataset,
    edge.sourceField,
    edge.targetDataset,
    edge.targetField,
    edge.transformationType,
    edge.transformationSubtype,
  ].join('->');

  if (!edgeMap.has(key)) {
    edgeMap.set(key, edge);
  }
}

function ensureStepJob(
  stepJobs: Map<string, ParsedJob>,
  stepById: Map<string, CanonicalStep>,
  knownJclNames: string[],
  stepId: string,
): string {
  const step = stepById.get(stepId);
  const stepJobKey = buildStepJobKey(step, knownJclNames, stepId);

  if (!stepJobs.has(stepJobKey)) {
    stepJobs.set(stepJobKey, {
      name: stepJobKey,
      namespace: 'mainframe://job',
      type: 'BATCH_STEP',
      processingType: 'MAINFRAME',
      integration: 'CANONICAL_BUNDLE',
      latestEventType: 'COMPLETE',
      latestEventTime: '',
      runId: stepJobKey,
      stepName: step?.step_name,
      programName: step?.program_name || step?.jcl_program,
      stepType: step?.step_type,
      planName: step?.plan_name,
      inputDdNames: step?.input_ddnames,
      outputDdNames: step?.output_ddnames,
      jclName: resolveCanonicalJclName(step, knownJclNames),
    });
  }

  return stepJobKey;
}

function addTableLineageEdge(
  edgeSet: Set<string>,
  edges: Array<{ source: string; target: string; job: string }>,
  source: string,
  target: string,
  job: string,
): void {
  const key = `${source}->${target}`;
  if (!edgeSet.has(key)) {
    edgeSet.add(key);
    edges.push({ source, target, job });
  }
}

function buildFieldType(column: CanonicalColumn): string {
  const scaleSuffix = column.scale && column.scale !== '0' ? `,${column.scale}` : '';
  const lengthSuffix = column.length ? `(${column.length}${scaleSuffix})` : '';
  return `${column.data_type}${lengthSuffix}`;
}

function datasetKey(entity: CanonicalEntity): string {
  return `${normalizeNamespace(entity.system)}::${entity.entity_name}`;
}

function normalizeNamespace(system: string): string {
  const normalized = String(system || '').toLowerCase();
  if (normalized.includes('db2')) {
    return 'mainframe://db2';
  }
  if (normalized.includes('hard')) {
    return 'mainframe://hardcode';
  }
  return 'mainframe://dataset';
}

function extractLiteral(expression: string): string {
  const match = String(expression || '').match(/'([^']+)'/);
  return match ? match[1] : '';
}

function resolveBundleJclNames(
  jobControlArtifacts: ParsedArtifact[],
  steps: CanonicalStep[],
): string[] {
  const artifactNames = jobControlArtifacts.map((artifact) => artifact.name).filter(Boolean);
  if (artifactNames.length) {
    return Array.from(new Set(artifactNames));
  }

  return Array.from(new Set(steps.map((step) => step.job_id).filter(Boolean)));
}

function resolveCanonicalJclName(
  step: CanonicalStep | undefined,
  knownJclNames: string[],
): string | undefined {
  if (knownJclNames.length === 1) {
    return knownJclNames[0];
  }

  if (step?.job_id && knownJclNames.includes(step.job_id)) {
    return step.job_id;
  }

  return step?.job_id || knownJclNames[0];
}

function buildStepJobKey(
  step: CanonicalStep | undefined,
  knownJclNames: string[],
  stepId: string,
): string {
  const jclName = resolveCanonicalJclName(step, knownJclNames) || 'UNKNOWN_JCL';
  return `${jclName}::${stepId}`;
}

function addUnique(values: string[] | undefined, value: string | undefined): string[] {
  if (!value) {
    return values || [];
  }
  if (!values) {
    return [value];
  }
  return values.includes(value) ? values : [...values, value];
}

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((item) => item.some((value) => value !== ''));
  if (!headers) {
    return [];
  }

  return body.map((cells) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] || '';
    });
    return record;
  });
}
