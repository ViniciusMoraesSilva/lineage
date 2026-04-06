'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Position,
  MarkerType,
  Handle,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useThemeContext } from './ThemeProvider';
import { ParsedLineage } from '@/lib/types';

interface TableLineageProps {
  data: ParsedLineage;
}

// Custom node for datasets
function DatasetNode({ data }: NodeProps) {
  const nodeData = data as {
    label: string;
    role: string;
    fields: string[];
    subtitle?: string;
    isDark: boolean;
  };
  const { isDark } = nodeData;

  const roleColors: Record<string, string> = {
    source: '#0078D4',
    intermediate: '#F2C811',
    target: '#107C10',
  };
  const accentColor = roleColors[nodeData.role] || '#0078D4';

  return (
    <div
      style={{
        backgroundColor: isDark ? '#252423' : '#FFFFFF',
        border: `1px solid ${isDark ? '#484644' : '#EDEBE9'}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '6px',
        minWidth: '180px',
        fontFamily: "'Segoe UI', sans-serif",
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: accentColor, border: 'none', width: 8, height: 8 }} />
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill={accentColor}>
          <path d="M8 1C4.5 1 2 2.1 2 3.5v9C2 13.9 4.5 15 8 15s6-1.1 6-2.5v-9C14 2.1 11.5 1 8 1zm0 1.5c3 0 4.5.8 4.5 1S11 4.5 8 4.5 3.5 3.7 3.5 3.5 5 2.5 8 2.5zM3.5 12.5v-1.8C4.8 11.5 6.3 12 8 12s3.2-.5 4.5-1.3v1.8c0 .2-1.5 1-4.5 1s-4.5-.8-4.5-1z" />
        </svg>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isDark ? '#FAF9F8' : '#323130',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '220px',
            }}
            title={nodeData.label}
          >
            {nodeData.label}
          </div>
          {nodeData.subtitle ? (
            <div
              style={{
                marginTop: '4px',
                fontSize: '10px',
                color: isDark ? '#A19F9D' : '#605E5C',
                lineHeight: '1.4',
                maxWidth: '220px',
              }}
              title={nodeData.subtitle}
            >
              {nodeData.subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {nodeData.fields.length > 0 && (
        <div style={{ padding: '6px 12px' }}>
          {nodeData.fields.map((f: string) => (
            <div
              key={f}
              style={{
                fontSize: '11px',
                color: isDark ? '#A19F9D' : '#605E5C',
                padding: '2px 0',
                fontFamily: "'Segoe UI', monospace",
              }}
            >
              {f}
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: accentColor, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

// Custom node for jobs
function JobNode({ data }: NodeProps) {
  const nodeData = data as {
    label: string;
    type: string;
    isDark: boolean;
    stepName?: string;
    programName?: string;
    planName?: string;
  };
  const { isDark } = nodeData;

  return (
    <div
      style={{
        backgroundColor: isDark ? '#2C2B2A' : '#FFF8E1',
        border: `1px solid ${isDark ? '#484644' : '#E1DFDD'}`,
        borderRadius: '20px',
        padding: '8px 16px',
        fontFamily: "'Segoe UI', sans-serif",
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        maxWidth: '240px',
        minWidth: '240px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#F2C811', border: 'none', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="#F2C811">
          <path d="M2 3h12v2H2V3zm1 3h10v1H3V6zm0 2h10v1H3V8zm0 2h10v1H3v-1zm0 2h7v1H3v-1z" />
        </svg>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: isDark ? '#FAF9F8' : '#323130',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={nodeData.stepName || nodeData.label}
        >
          {(nodeData.stepName || nodeData.label).replace('local_session.', '').replace(/_/g, ' ')}
        </span>
      </div>
      <div style={{ fontSize: '10px', color: isDark ? '#D2D0CE' : '#605E5C', lineHeight: '1.45' }}>
        {nodeData.programName || nodeData.type}
        {nodeData.planName ? ` • ${nodeData.planName}` : ''}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#F2C811', border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { dataset: DatasetNode, job: JobNode };

function estimateNodeSize(node: Node): { width: number; height: number } {
  if (node.type === 'dataset') {
    const fields = ((node.data as { fields?: string[] }).fields || []).length;
    const subtitle = ((node.data as { subtitle?: string }).subtitle || '').trim();
    return {
      width: 260,
      height: 54 + (subtitle ? 24 : 0) + fields * 18 + 24,
    };
  }

  return {
    width: 280,
    height: 82,
  };
}

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 110, ranksep: 180, marginx: 30, marginy: 30 });

  nodes.forEach((node) => {
    const estimated = estimateNodeSize(node);
    g.setNode(node.id, {
      width: node.measured?.width || estimated.width,
      height: node.measured?.height || estimated.height,
    });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });
  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const estimated = estimateNodeSize(node);
    const w = node.measured?.width || estimated.width;
    const h = node.measured?.height || estimated.height;
    return {
      ...node,
      position: { x: nodeWithPosition.x - w / 2, y: nodeWithPosition.y - h / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

const TableLineage = ({ data }: TableLineageProps) => {
  const { isDark } = useThemeContext();

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const addedNodes = new Set<string>();

    // Add dataset nodes
    for (const ds of data.datasets) {
      const key = `${ds.namespace}::${ds.name}`;
      if (!addedNodes.has(key)) {
        addedNodes.add(key);
        nodes.push({
          id: key,
          type: 'dataset',
          position: { x: 0, y: 0 },
          data: {
            label: ds.shortName,
            role: ds.role,
            fields: ds.schema.map((f) => f.name),
            subtitle: buildDatasetSubtitle(ds.relatedSteps, ds.relatedPrograms, ds.jclNames),
            isDark,
          },
        });
      }
    }

    // Add job nodes
    for (const job of data.jobs) {
      if (!addedNodes.has(job.name)) {
        addedNodes.add(job.name);
        nodes.push({
          id: job.name,
          type: 'job',
          position: { x: 0, y: 0 },
          data: {
            label: job.name,
            type: job.type,
            isDark,
            stepName: job.stepName,
            programName: job.programName,
            planName: job.planName,
          },
        });
      }
    }

    // Add edges
    for (const edge of data.tableLineageEdges) {
      if (addedNodes.has(edge.source) && addedNodes.has(edge.target)) {
        edges.push({
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          animated: false,
          style: { stroke: isDark ? '#484644' : '#C8C6C4', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#484644' : '#C8C6C4', width: 12, height: 12 },
        });
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, isDark]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  return (
    <section style={{ padding: '0 24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: isDark ? '#FAF9F8' : '#323130',
            fontFamily: "'Segoe UI', sans-serif",
            marginBottom: '4px',
          }}
        >
          Table-Level Lineage
        </h2>
        <p style={{ fontSize: '13px', color: isDark ? '#A19F9D' : '#605E5C', fontFamily: "'Segoe UI', sans-serif" }}>
          Data flow from source datasets through transformation jobs to target datasets.
          Os jobs mostram informacoes de `steps.csv` quando disponiveis.
          <span style={{ marginLeft: '16px' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: '#0078D4', marginRight: 4, verticalAlign: 'middle' }} />Source
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: '#F2C811', margin: '0 4px 0 12px', verticalAlign: 'middle' }} />Job
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: '#107C10', margin: '0 4px 0 12px', verticalAlign: 'middle' }} />Target
          </span>
        </p>
      </div>
      <div
        style={{
          height: '500px',
          backgroundColor: isDark ? '#201F1E' : '#FAF9F8',
          border: `1px solid ${isDark ? '#323130' : '#EDEBE9'}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <ReactFlow
          nodes={layoutedNodes}
          edges={layoutedEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={isDark ? '#323130' : '#EDEBE9'} gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{
              backgroundColor: isDark ? '#252423' : '#FFFFFF',
              border: `1px solid ${isDark ? '#484644' : '#EDEBE9'}`,
              borderRadius: '4px',
            }}
          />
        </ReactFlow>
      </div>
    </section>
  );
};

export default TableLineage;

function buildDatasetSubtitle(
  relatedSteps?: string[],
  relatedPrograms?: string[],
  jclNames?: string[],
): string {
  const parts = [
    relatedSteps?.length ? `Step ${relatedSteps.slice(0, 2).join(', ')}` : '',
    relatedPrograms?.length ? `Programa ${relatedPrograms[0]}` : '',
    jclNames?.length ? `JCL ${jclNames[0]}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}
