'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import { toast } from '@/lib/toast';
import { Save, Loader2, ArrowLeft, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import Sheet from '@/components/common/sheet';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodeSidebar } from './NodeSidebar';
import { NodeConfigPanel } from './NodeConfigPanel';
import { NodeEditDialog, type EmailNodeEditConfig } from './NodeEditDialog';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType, CanvasNode, GroupNode } from './types';
import { NODE_TYPES_CONFIG } from './node-config';
import { saveWorkflow } from '@/app/[locale]/(dashboard)/settings/workflows/[id]/actions';

// wait_email_reply queda fuera: ya no tiene subject/body propios que un
// abogado pueda personalizar por caso — el diálogo de edición (NodeEditDialog)
// está pensado para esos campos.
const EDITABLE_NODE_TYPES: WorkflowNodeType[] = ['send_email', 'send_documents'];

interface WorkflowEditorProps {
  templateId: string;
  templateName: string;
  initialNodes: CanvasNode[];
  initialEdges: WorkflowEdge[];
  /** When true, all editing controls are hidden and no mutations are allowed. */
  readOnly?: boolean;
  /** Custom save action. Defaults to the settings-page saveWorkflow. */
  onSave?: (templateId: string, nodes: CanvasNode[], edges: WorkflowEdge[]) => Promise<void>;
  /** URL for the back-arrow button. Defaults to /settings/workflows. */
  backHref?: string;
  /** Extra classes for the top bar (e.g. hide it at some breakpoints). */
  headerClassName?: string;
  /**
   * When provided in readOnly mode, clicking an editable node (send_email,
   * send_documents) opens a limited dialog to edit subject + body.
   */
  onNodeEdit?: (
    templateId: string,
    nodeId: string,
    config: EmailNodeEditConfig,
  ) => Promise<void>;
}

function WorkflowEditorInner({
  templateId,
  templateName,
  initialNodes,
  initialEdges,
  readOnly = false,
  onSave,
  backHref = '/settings/workflows',
  headerClassName,
  onNodeEdit,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [editNode, setEditNode] = useState<WorkflowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          { ...connection, type: 'bezier', animated: false } as WorkflowEdge,
          eds,
        ),
      ),
    [setEdges],
  );

  const onEdgeReconnect = useCallback(
    (oldEdge: WorkflowEdge, newConnection: Connection) =>
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds) as WorkflowEdge[]),
    [setEdges],
  );

  const handleNodeEdit = useCallback(
    async (
      tid: string,
      nodeId: string,
      config: EmailNodeEditConfig,
    ) => {
      if (!onNodeEdit) return;
      await onNodeEdit(tid, nodeId, config);
      // Update local node state so the dialog shows fresh data on reopen
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId && n.type !== 'group'
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as object), ...config } } }
            : n,
        ),
      );
      // Also refresh editNode if it's the one that was updated
      setEditNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, config: { ...(prev.data.config as object), ...config } } }
          : prev,
      );
    },
    [onNodeEdit, setNodes],
  );

  const onNodeClick = useCallback(
    (node: CanvasNode) => {
      // Los grupos son puramente visuales — no tienen config que editar, así
      // que el doble-click no debe abrir el panel de configuración (que
      // asume WorkflowNodeData/NODE_TYPES_CONFIG y rompería con un grupo).
      if (node.type === 'group') return;
      if (readOnly && onNodeEdit && EDITABLE_NODE_TYPES.includes(node.data.type as WorkflowNodeType)) {
        setEditNode(node);
      } else {
        setSelectedNode(node);
      }
    },
    [readOnly, onNodeEdit],
  );

  const onAddNode = useCallback(
    (node: WorkflowNode) => {
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const onUpdateNode = useCallback(
    (id: string, data: Partial<WorkflowNode['data']>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id && n.type !== 'group' ? { ...n, data: { ...n.data, ...data } } : n)),
      );
      setSelectedNode((prev) =>
        prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev,
      );
    },
    [setNodes],
  );

  const displayNodes = useMemo(
    () => readOnly
      ? nodes.map((n) =>
          n.type === 'group'
            ? n
            : {
                ...n,
                data: {
                  ...n.data,
                  dimmed: !EDITABLE_NODE_TYPES.includes(n.data.type as WorkflowNodeType),
                },
              },
        )
      : nodes,
    [nodes, readOnly],
  );

  const selectedNodes = nodes.filter(n => n.selected);

  // Ref always contains current selected IDs — used inside align callbacks
  // to avoid stale closures without adding selectedNodes to dependencies.
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedIdsRef.current = selectedNodes.map(n => n.id);
  });

  const makeAlignFn = useCallback(
    (axis: 'x' | 'y', strategy: 'min' | 'avg' | 'max') =>
      () => {
        const ids = new Set(selectedIdsRef.current);
        if (ids.size < 2) return;
        setNodes(current => {
          const sel = current.filter(n => ids.has(n.id));
          const values = sel.map(n => n.position[axis]);
          const target =
            strategy === 'min' ? Math.min(...values)
            : strategy === 'max' ? Math.max(...values)
            : values.reduce((a, b) => a + b, 0) / values.length;
          return current.map(n =>
            ids.has(n.id)
              ? { ...n, position: { ...n.position, [axis]: target } }
              : n,
          );
        });
      },
    [setNodes],
  );

  const alignY = makeAlignFn('y', 'avg');
  const alignX = makeAlignFn('x', 'avg');

  // Agrupar: envuelve la selección en un nodo contenedor (type: 'group') y
  // reparenta los nodos seleccionados con posición RELATIVA al grupo — el
  // mecanismo estándar de React Flow (parentId + extent: 'parent'). Es
  // puramente visual: no toca lib/workflow/, que nunca ve este nodo (vive en
  // su propia tabla workflow_node_groups, ver Save/Load de este template).
  const onGroup = useCallback(() => {
    const ids = new Set(selectedIdsRef.current);
    if (ids.size < 2) return;

    setNodes((current) => {
      const selected = current.filter((n) => ids.has(n.id));
      const invalid = selected.some(
        (n) => n.type === 'group' || n.parentId || n.type === 'start' || n.type === 'end',
      );
      if (invalid) {
        toast.error('No se puede agrupar esta selección', {
          description: 'Inicio, Fin y los nodos que ya están en un grupo no se pueden agrupar.',
        });
        return current;
      }

      const PADDING = 40;
      const HEADER = 32;
      const DEFAULT_W = 220;
      const DEFAULT_H = 90;

      const bounds = selected.reduce(
        (acc, n) => {
          const w = n.measured?.width ?? n.width ?? DEFAULT_W;
          const h = n.measured?.height ?? n.height ?? DEFAULT_H;
          return {
            minX: Math.min(acc.minX, n.position.x),
            minY: Math.min(acc.minY, n.position.y),
            maxX: Math.max(acc.maxX, n.position.x + w),
            maxY: Math.max(acc.maxY, n.position.y + h),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      const groupPosition = { x: bounds.minX - PADDING, y: bounds.minY - PADDING - HEADER };
      const groupId = `group-${Date.now()}`;
      const groupNode: GroupNode = {
        id: groupId,
        type: 'group',
        position: groupPosition,
        style: {
          width: bounds.maxX - bounds.minX + PADDING * 2,
          height: bounds.maxY - bounds.minY + PADDING * 2 + HEADER,
        },
        data: { nodeId: groupId, title: 'Grupo' },
        selected: false,
      };

      // El nodo padre debe ir antes que sus hijos en el array (requisito de
      // React Flow) — de ahí el prepend en vez de insertarlo en su lugar.
      const reparented = current.map((n) =>
        ids.has(n.id)
          ? {
              ...n,
              parentId: groupId,
              extent: 'parent' as const,
              position: { x: n.position.x - groupPosition.x, y: n.position.y - groupPosition.y },
              selected: false,
            }
          : n,
      );

      return [groupNode, ...reparented];
    });
  }, [setNodes]);

  // Desagrupar: convierte la posición de cada hijo de relativa a absoluta y
  // quita el nodo de grupo — los hijos quedan sueltos exactamente donde se veían.
  const onUngroup = useCallback(
    (groupId: string) => {
      setNodes((current) => {
        const group = current.find((n) => n.id === groupId && n.type === 'group');
        if (!group) return current;

        return current
          .filter((n) => n.id !== groupId)
          .map((n) => {
            if (n.parentId !== groupId) return n;
            const { parentId: _parentId, extent: _extent, ...rest } = n;
            return {
              ...rest,
              position: { x: n.position.x + group.position.x, y: n.position.y + group.position.y },
            };
          });
      });
    },
    [setNodes],
  );

  // Si se borra un grupo (tecla Delete/Backspace con el grupo seleccionado),
  // sus hijos no se borran con él — quedan con un parentId colgando que RF
  // ya no puede resolver. Se promueven a top-level con la misma conversión
  // relativa→absoluta que onUngroup, usando la posición del grupo tal como
  // estaba justo antes de borrarse (el argumento `deleted` de onNodesDelete).
  const onNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      const deletedGroups = deleted.filter((n): n is GroupNode => n.type === 'group');
      if (deletedGroups.length === 0) return;

      setNodes((current) =>
        current.map((n) => {
          const group = n.parentId ? deletedGroups.find((g) => g.id === n.parentId) : undefined;
          if (!group) return n;
          const { parentId: _parentId, extent: _extent, ...rest } = n;
          return {
            ...rest,
            position: { x: n.position.x + group.position.x, y: n.position.y + group.position.y },
          };
        }),
      );
    },
    [setNodes],
  );

  const onDragStart = useCallback((event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saveFn = onSave ?? saveWorkflow;
      await saveFn(templateId, nodes, edges);
      toast.success('Flujo guardado correctamente');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <header className={cn('flex shrink-0 items-center justify-between border-b bg-card px-4 py-2', headerClassName)}>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <div>
            <h1 className="text-sm font-semibold leading-none">{templateName}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {nodes.length} nodos
              </Badge>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {edges.length} conexiones
              </Badge>
              {readOnly && (
                <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px] text-muted-foreground">
                  <Eye className="h-2.5 w-2.5" />
                  Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar flujo
          </Button>
        )}
      </header>

      {/* 3-panel layout */}
      <div className="flex min-h-0 flex-1">
        {!readOnly && <NodeSidebar onDragStart={onDragStart} />}

        <main className="relative flex-1">
          <WorkflowCanvas
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeReconnect={onEdgeReconnect}
            onNodeClick={onNodeClick}
            onAddNode={onAddNode}
            onPaneClick={() => setSelectedNode(null)}
            readOnly={readOnly}
            selectedNodeIds={selectedNodes.map((n) => n.id)}
            onAlignX={alignX}
            onAlignY={alignY}
            onGroup={onGroup}
            onUngroup={onUngroup}
            onNodesDelete={onNodesDelete}
          />
        </main>

      </div>

      {!readOnly && selectedNode && (() => {
        const cfg = NODE_TYPES_CONFIG[selectedNode.data.type as WorkflowNodeType];
        const Icon = ((LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[cfg.icon]) ?? LucideIcons.Circle;
        // Los grupos no tienen panel de configuración — se excluyen de la
        // navegación anterior/siguiente del Sheet (y de su contador).
        const configurableNodes = nodes.filter((n): n is WorkflowNode => n.type !== 'group');
        const currentIndex = configurableNodes.findIndex((n) => n.id === selectedNode.id);
        const prevNode = currentIndex > 0 ? configurableNodes[currentIndex - 1] : null;
        const nextNode = currentIndex < configurableNodes.length - 1 ? configurableNodes[currentIndex + 1] : null;

        return (
          <Sheet
            open
            onOpenChange={(open) => !open && setSelectedNode(null)}
            trigger={null}
            size="2xl"
            className="flex overflow-auto"
            title={
              <div className="flex flex-col gap-2 pr-6">
                <div className="flex gap-3 min-w-0 pb-4">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.colorClass)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-none">{cfg.label}</p>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">{cfg.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!prevNode}
                    onClick={(e) => { e.stopPropagation(); if (prevNode) setSelectedNode(prevNode); }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
                    {currentIndex + 1}/{configurableNodes.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!nextNode}
                    onClick={(e) => { e.stopPropagation(); if (nextNode) setSelectedNode(nextNode); }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            }
            body={
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                edges={edges}
                allNodes={nodes.filter((n): n is WorkflowNode => n.type !== 'group')}
                onUpdate={onUpdateNode}
                onClose={() => setSelectedNode(null)}
              />
            }
          />
        );
      })()}

      {onNodeEdit && (
        <NodeEditDialog
          node={editNode}
          templateId={templateId}
          onClose={() => setEditNode(null)}
          onSave={handleNodeEdit}
        />
      )}
    </div>
  );
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
