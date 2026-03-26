'use client';

import { memo } from 'react';
import { Handle, Position, useReactFlow, useConnection, useEdges, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_TYPES_CONFIG } from '../node-config';
import type { WorkflowNode, WorkflowNodeType } from '../types';

function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
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
  const { deleteElements } = useReactFlow();
  const connection = useConnection();
  const edges = useEdges();

  const isDimmed = data.dimmed === true;

  // True while the user is dragging any connection on the canvas
  const isConnecting = connection.inProgress;

  // Which handles on this node already have an edge attached
  const connectedHandles = new Set<string>();
  for (const edge of edges) {
    if (edge.source === id && edge.sourceHandle) connectedHandles.add(edge.sourceHandle);
    if (edge.target === id && edge.targetHandle) connectedHandles.add(edge.targetHandle);
  }

  // In read-only mode: configurable nodes keep full style; non-configurable are dimmed
  const isReadOnly = data.dimmed !== undefined;
  const isConfigurable = isReadOnly && !isDimmed;

  return (
    <div
      className={cn(
        'group relative min-w-[180px] max-w-[220px] rounded-xl border-2 bg-card shadow-sm transition-all duration-150',
        isDimmed && 'opacity-35 border-border pointer-events-none',
        !isDimmed && !isConfigurable && (selected ? `${cfg.borderClass} shadow-lg` : 'border-border hover:border-muted-foreground'),
        isConfigurable && `${cfg.borderClass} shadow-md cursor-pointer`,
      )}
    >
      {/* Delete button — hidden in read-only mode */}
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

      {/* Handles — visible only when connected or while dragging a connection */}
      {POSITIONS.map(({ pos, id: side }) => (
        <span key={side}>
          {cfg.hasTargetHandle && (
            <Handle
              type="target"
              position={pos}
              id={`target-${side}`}
              className={cn(
                '!h-3 !w-3 !border-2 !border-card !bg-muted-foreground !transition-opacity !duration-150',
                connectedHandles.has(`target-${side}`) || isConnecting
                  ? '!opacity-100'
                  : '!opacity-0',
              )}
            />
          )}
          {cfg.hasSourceHandle && (
            <Handle
              type="source"
              position={pos}
              id={`source-${side}`}
              className={cn(
                '!h-3 !w-3 !border-2 !border-card !bg-primary !transition-opacity !duration-150',
                connectedHandles.has(`source-${side}`) || isConnecting
                  ? '!opacity-100'
                  : '!opacity-0',
              )}
            />
          )}
        </span>
      ))}

      {/* Colored header */}
      <div className={cn('flex items-center gap-2 rounded-t-[10px] px-3 py-2', cfg.colorClass)}>
        <Icon className="h-3.5 w-3.5 shrink-0 text-white" />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-white">
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-foreground">{data.title as string}</p>
      </div>
    </div>
  );
});
