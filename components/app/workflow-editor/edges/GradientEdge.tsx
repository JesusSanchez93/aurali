'use client';

import { getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { NODE_TYPES_CONFIG } from '../node-config';
import type { WorkflowNodeType } from '../types';

const COLOR_MAP: Record<string, string> = {
  'bg-emerald-500': '#10b981',
  'bg-blue-500':    '#3b82f6',
  'bg-violet-500':  '#8b5cf6',
  'bg-amber-500':   '#f59e0b',
  'bg-orange-500':  '#f97316',
  'bg-cyan-500':    '#06b6d4',
  'bg-rose-500':    '#f43f5e',
  'bg-slate-500':   '#64748b',
  'bg-indigo-500':  '#6366f1',
  'bg-teal-500':    '#14b8a6',
};

function getNodeColor(nodeType?: string): string {
  if (!nodeType) return '#6366f1';
  const cfg = NODE_TYPES_CONFIG[nodeType as WorkflowNodeType];
  return COLOR_MAP[cfg?.colorClass] ?? '#6366f1';
}

export function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
}: EdgeProps) {
  const { getNode } = useReactFlow();
  const sourceColor = getNodeColor(getNode(source)?.type);
  const targetColor = getNodeColor(getNode(target)?.type);
  const gradientId = `gradient-${id}`;
  const arrowId = `arrow-${id}`;

  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
        {/* Punta de flecha al final de la conexión (lado target/entrada) —
            deja clara la dirección salida → entrada entre dos nodos. Trazo
            abierto tipo "chevron" (>), no triángulo relleno. Coloreada con
            el color del nodo destino, igual criterio que el gradiente. */}
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5.5"
          markerHeight="5.5"
          orient="auto-start-reverse"
        >
          <path
            className="workflow-edge-arrow"
            d="M 1 1 L 8 5 L 1 9"
            fill="none"
            stroke={targetColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <path
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
      />
    </>
  );
}
