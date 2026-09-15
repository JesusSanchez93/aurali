'use client';

import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeToolbar,
  Position,
  useReactFlow,
  ConnectionLineType,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlignCenterHorizontal, AlignCenterVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nodeTypes } from './nodes';
import { GradientEdge } from './edges/GradientEdge';
import { NODE_TYPES_CONFIG } from './node-config';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from './types';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: OnConnect;
  onEdgeReconnect: (oldEdge: WorkflowEdge, newConnection: Connection) => void;
  onNodeClick: (node: WorkflowNode) => void;
  onAddNode: (node: WorkflowNode) => void;
  onPaneClick: () => void;
  readOnly?: boolean;
  /** IDs of the currently multi-selected nodes — drives the floating align
   *  toolbar below, positioned over their bounding box (via NodeToolbar) so
   *  it follows the selection instead of sitting fixed at the top. */
  selectedNodeIds?: string[];
  onAlignX?: () => void;
  onAlignY?: () => void;
}

const edgeTypes = { bezier: GradientEdge };

const DEFAULT_EDGE_OPTIONS = {
  type: 'bezier',
  animated: false,
  style: { strokeWidth: 2 },
};

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeReconnect,
  onNodeClick,
  onAddNode,
  onPaneClick,
  readOnly = false,
  selectedNodeIds = [],
  onAlignX,
  onAlignY,
}: WorkflowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const cfg = NODE_TYPES_CONFIG[type];
      const nodeId = `${type}-${Date.now()}`;

      const newNode: WorkflowNode = {
        id: nodeId,
        type,
        position,
        data: {
          nodeId,
          type,
          title: cfg.defaultTitle,
          config: { ...cfg.defaultConfig },
        },
      };

      onAddNode(newNode);
    },
    [screenToFlowPosition, onAddNode],
  );

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onReconnect={readOnly ? undefined : onEdgeReconnect}
        onDragOver={readOnly ? undefined : onDragOver}
        onDrop={readOnly ? undefined : onDrop}
        onNodeClick={readOnly ? (_, node) => onNodeClick(node as WorkflowNode) : undefined}
        onNodeDoubleClick={!readOnly ? (_, node) => onNodeClick(node as WorkflowNode) : undefined}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        deleteKeyCode={readOnly ? null : 'Delete'}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        multiSelectionKeyCode="Shift"
        selectionOnDrag={!readOnly}
        panOnDrag={readOnly ? true : [1, 2]}
        panOnScroll={!readOnly}
        panActivationKeyCode="Meta"
        proOptions={{ hideAttribution: true }}
      >
        {!readOnly && selectedNodeIds.length >= 2 && (
          <NodeToolbar
            nodeId={selectedNodeIds}
            isVisible
            position={Position.Top}
            className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 shadow-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="pr-1 text-xs text-muted-foreground">{selectedNodeIds.length} nodos</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAlignY} title="Alinear horizontal">
              <AlignCenterHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAlignX} title="Alinear vertical">
              <AlignCenterVertical className="h-4 w-4" />
            </Button>
          </NodeToolbar>
        )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="opacity-50"
          color="hsl(var(--muted-foreground))"
        />
        <Controls className="rounded-lg border bg-card shadow-sm" />
        <MiniMap
          nodeColor={(node) => {
            const cfg = NODE_TYPES_CONFIG[(node.type ?? 'manual_action') as WorkflowNodeType];
            // Extract the actual color from the tailwind class (fallback to indigo)
            const colorMap: Record<string, string> = {
              'bg-emerald-500': '#10b981',
              'bg-blue-500': '#3b82f6',
              'bg-violet-500': '#8b5cf6',
              'bg-amber-500': '#f59e0b',
              'bg-orange-500': '#f97316',
              'bg-cyan-500': '#06b6d4',
              'bg-rose-500': '#f43f5e',
              'bg-slate-500': '#64748b',
              'bg-indigo-500': '#6366f1',
              'bg-teal-500': '#14b8a6',
            };
            return colorMap[cfg.colorClass] ?? '#6366f1';
          }}
          className="rounded-lg border bg-card shadow-sm"
          maskColor="hsl(var(--muted) / 0.6)"
        />
      </ReactFlow>
    </div>
  );
}
