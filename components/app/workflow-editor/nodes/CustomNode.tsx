'use client';

import { memo, useState } from 'react';
import { Handle, Position, useReactFlow, useConnection, useEdges, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_TYPES_CONFIG } from '../node-config';
import type { WorkflowNode, WorkflowNodeType } from '../types';

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
};

function getIcon(name: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  const icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[name];
  return icon ?? LucideIcons.Circle;
}

const POSITIONS = [
  { pos: Position.Top,    id: 'top' },
  { pos: Position.Right,  id: 'right' },
  { pos: Position.Bottom, id: 'bottom' },
  { pos: Position.Left,   id: 'left' },
];

export const CustomNode = memo(function CustomNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNode>) {
  const cfg = NODE_TYPES_CONFIG[data.type as WorkflowNodeType];
  const Icon = getIcon(cfg.icon);
  const hex = COLOR_MAP[cfg.colorClass] ?? '#6366f1';
  const { deleteElements } = useReactFlow();
  const connection = useConnection();
  const edges = useEdges();

  const isDimmed = data.dimmed === true;
  const isConnecting = connection.inProgress;

  const connectedHandles = new Set<string>();
  for (const edge of edges) {
    if (edge.source === id && edge.sourceHandle) connectedHandles.add(edge.sourceHandle);
    if (edge.target === id && edge.targetHandle) connectedHandles.add(edge.targetHandle);
  }

  const isReadOnly = data.dimmed !== undefined;
  const isConfigurable = isReadOnly && !isDimmed;
  const [isHovered, setIsHovered] = useState(false);

  const showAccentBorder = !isDimmed && (selected || isHovered || isConfigurable);

  return (
    <div
      className={cn(
        'group relative min-w-[180px] max-w-[220px] rounded-lg border bg-card transition-all duration-150',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        isDimmed && 'pointer-events-none border-border opacity-35',
        !isDimmed && !isConfigurable && (
          selected
            ? 'shadow-[0_4px_16px_rgba(0,0,0,0.12)]'
            : 'border-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]'
        ),
        isConfigurable && 'cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.10)]',
      )}
      style={showAccentBorder ? { borderColor: hex } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button */}
      {!isReadOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteElements({ nodes: [{ id }] });
          }}
          className={cn(
            'absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Handles */}
      {POSITIONS.map(({ pos, id: side }) => (
        <span key={side}>
          {cfg.hasTargetHandle && (
            <Handle
              type="target"
              position={pos}
              id={`target-${side}`}
              className={cn(
                '!h-2.5 !w-2.5 !border-0 !transition-opacity !duration-150',
                connectedHandles.has(`target-${side}`) || isConnecting ? '!opacity-100' : '!opacity-0',
              )}
              style={{
                backgroundColor: hex,
                boxShadow: `0 0 0 3px ${hex}35, 0 0 8px ${hex}20`,
              }}
            />
          )}
          {cfg.hasSourceHandle && (
            <Handle
              type="source"
              position={pos}
              id={`source-${side}`}
              className={cn(
                '!h-2.5 !w-2.5 !border-0 !transition-opacity !duration-150',
                connectedHandles.has(`source-${side}`) || isConnecting ? '!opacity-100' : '!opacity-0',
              )}
              style={{
                backgroundColor: hex,
                boxShadow: `0 0 0 3px ${hex}35, 0 0 8px ${hex}20`,
              }}
            />
          )}
        </span>
      ))}

      {/* Card body */}
      <div className="flex items-center gap-3 px-3 py-3">
        {/* Icon — square 1:1 with gradient */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          style={{ background: `linear-gradient(135deg, ${hex}30, ${hex}12)` }}
        >
          <Icon className="h-4 w-4" style={{ color: hex }} />
        </div>

        {/* Text */}
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {cfg.label}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{data.title as string}</p>
        </div>
      </div>
    </div>
  );
});
