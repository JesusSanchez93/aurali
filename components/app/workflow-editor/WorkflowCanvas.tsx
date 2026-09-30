'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeToolbar,
  Panel,
  Position,
  useReactFlow,
  useStore,
  ConnectionLineType,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlignCenterHorizontal, AlignCenterVertical, ChevronLeft, ChevronRight, Group, Ungroup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { nodeTypes } from './nodes';
import { GradientEdge } from './edges/GradientEdge';
import { NODE_TYPES_CONFIG } from './node-config';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType, CanvasNode } from './types';

interface WorkflowCanvasProps {
  nodes: CanvasNode[];
  edges: WorkflowEdge[];
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: OnConnect;
  onEdgeReconnect: (oldEdge: WorkflowEdge, newConnection: Connection) => void;
  onNodeClick: (node: CanvasNode) => void;
  onAddNode: (node: WorkflowNode) => void;
  onPaneClick: () => void;
  readOnly?: boolean;
  /** IDs of the currently multi-selected nodes — drives the floating align
   *  toolbar below, positioned over their bounding box (via NodeToolbar) so
   *  it follows the selection instead of sitting fixed at the top. */
  selectedNodeIds?: string[];
  onAlignX?: () => void;
  onAlignY?: () => void;
  /** Agrupa la selección actual (2+ nodos, ninguno start/end ni ya agrupado). */
  onGroup?: () => void;
  /** Deshace un grupo, devolviendo sus hijos a posición absoluta. */
  onUngroup?: (groupId: string) => void;
  /** Se llama cuando se borran nodos (ej. tecla Delete) — usado para
   *  promover a top-level los hijos de un grupo que se borró con ellos. */
  onNodesDelete?: (deleted: CanvasNode[]) => void;
}

const edgeTypes = { bezier: GradientEdge };

const FOCUS_ANIMATION_MS = 700;
/** Nodes whose y differs less than this are considered to be on the same row. */
const ROW_TOLERANCE_PX = 30;
const OVERVIEW_TOP_MARGIN_PX = 16;

/** Read-only mode: floating prev/next buttons that fly the camera node by node. */
function NodeStepper({ nodes: unordered }: { nodes: WorkflowNode[] }) {
  const { fitView, setCenter, getNodesBounds } = useReactFlow();
  const viewportHeight = useStore((state) => state.height);
  const [index, setIndex] = useState(-1);
  const [onlyActive, setOnlyActive] = useState(false);
  // Reading order: top to bottom, then left to right within the same row.
  // "Active" nodes are the ones not dimmed in read-only mode (the editable ones).
  const nodes = useMemo(
    () =>
      unordered
        .filter((n) => !onlyActive || (n.data as { dimmed?: boolean }).dimmed !== true)
        .sort((a, b) =>
          Math.abs(a.position.y - b.position.y) > ROW_TOLERANCE_PX
            ? a.position.y - b.position.y
            : a.position.x - b.position.x,
        ),
    [unordered, onlyActive],
  );

  /** Overview: zoom 1, flow horizontally centered and pinned to the top edge. */
  function showOverview() {
    const bounds = getNodesBounds(unordered);
    setCenter(bounds.x + bounds.width / 2, bounds.y - OVERVIEW_TOP_MARGIN_PX + viewportHeight / 2, {
      zoom: 1,
      duration: FOCUS_ANIMATION_MS,
    });
  }

  function toggleOnlyActive(checked: boolean) {
    setOnlyActive(checked);
    setIndex(-1);
    showOverview();
  }

  // Wrap around: next from the last node goes to the first, prev from the first goes to the last.
  function goNext() {
    go(index >= nodes.length - 1 ? 0 : index + 1);
  }

  function goPrev() {
    go(index <= 0 ? nodes.length - 1 : index - 1);
  }

  function go(next: number) {
    const target = nodes[next];
    if (!target) return;
    setIndex(next);
    fitView({
      nodes: [{ id: target.id }],
      padding: 1.2,
      maxZoom: 1.1,
      duration: FOCUS_ANIMATION_MS,
    });
  }

  return (
    <>
    <Panel position="top-center" className="mt-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
        <Checkbox checked={onlyActive} onCheckedChange={(v) => toggleOnlyActive(v === true)} />
        Solo nodos activos
      </label>
    </Panel>
    <Panel position="bottom-center" className="mb-4 flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full border shadow-md"
        onClick={goPrev}
        disabled={nodes.length === 0}
        title="Nodo anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full border shadow-md"
        onClick={goNext}
        disabled={nodes.length === 0}
        title="Nodo siguiente"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </Panel>
    </>
  );
}

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
  onGroup,
  onUngroup,
  onNodesDelete,
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
        onNodeClick={readOnly ? (_, node) => onNodeClick(node as CanvasNode) : undefined}
        onNodeDoubleClick={!readOnly ? (_, node) => onNodeClick(node as CanvasNode) : undefined}
        onNodesDelete={readOnly ? undefined : onNodesDelete}
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
        panOnDrag={readOnly ? false : [1, 2]}
        panOnScroll={!readOnly}
        zoomOnScroll={!readOnly}
        zoomOnPinch={!readOnly}
        zoomOnDoubleClick={!readOnly}
        preventScrolling={!readOnly}
        panActivationKeyCode="Meta"
        proOptions={{ hideAttribution: true }}
      >
        {!readOnly && selectedNodeIds.length >= 1 && (() => {
          const selected = nodes.filter((n) => selectedNodeIds.includes(n.id));
          const showAlign = selected.length >= 2;
          // Agrupar: 2+ nodos sueltos, sin Inicio/Fin ni nodos ya agrupados —
          // más estricto que showAlign, que sigue disponible para cualquier
          // selección de 2+ (comportamiento preexistente, sin cambios).
          const canGroup =
            showAlign &&
            selected.every((n) => n.type !== 'group' && !n.parentId && n.type !== 'start' && n.type !== 'end');
          // Desagrupar: exactamente un grupo seleccionado.
          const ungroupTarget = selected.length === 1 && selected[0].type === 'group' ? selected[0].id : null;

          if (!showAlign && !ungroupTarget) return null;

          return (
            <NodeToolbar
              nodeId={selectedNodeIds}
              isVisible
              position={Position.Top}
              className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 shadow-md"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {showAlign && (
                <>
                  <span className="pr-1 text-xs text-muted-foreground">{selectedNodeIds.length} nodos</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAlignY} title="Alinear horizontal">
                    <AlignCenterHorizontal className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAlignX} title="Alinear vertical">
                    <AlignCenterVertical className="h-4 w-4" />
                  </Button>
                  {canGroup && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGroup} title="Agrupar">
                      <Group className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
              {ungroupTarget && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUngroup?.(ungroupTarget)}
                  title="Desagrupar"
                >
                  <Ungroup className="h-4 w-4" />
                </Button>
              )}
            </NodeToolbar>
          );
        })()}
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="opacity-50"
          color="hsl(var(--muted-foreground))"
        />
        {readOnly ? (
          <NodeStepper nodes={nodes.filter((n): n is WorkflowNode => n.type !== 'group')} />
        ) : (
          <Controls className="rounded-lg border bg-card shadow-sm" />
        )}
        {!readOnly && (
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'group') return '#94a3b8';
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
        )}
      </ReactFlow>
    </div>
  );
}
