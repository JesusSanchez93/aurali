'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import { toast } from 'sonner';
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
import { NodeEditDialog } from './NodeEditDialog';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from './types';
import { NODE_TYPES_CONFIG } from './node-config';
import { saveWorkflow } from '@/app/[locale]/(dashboard)/settings/workflows/[id]/actions';

const EDITABLE_NODE_TYPES: WorkflowNodeType[] = ['send_email', 'send_documents', 'generate_document'];

export interface DocumentTemplate {
  id: string;
  name: string;
}

interface WorkflowEditorProps {
  templateId: string;
  templateName: string;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  /** When true, all editing controls are hidden and no mutations are allowed. */
  readOnly?: boolean;
  /** Custom save action. Defaults to the settings-page saveWorkflow. */
  onSave?: (templateId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => Promise<void>;
  /** URL for the back-arrow button. Defaults to /settings/workflows. */
  backHref?: string;
  /**
   * When provided in readOnly mode, clicking an editable node (send_email,
   * send_documents) opens a limited dialog to edit subject + body.
   */
  onNodeEdit?: (
    templateId: string,
    nodeId: string,
    config: { subject?: string; body?: unknown; attach_document_template_ids?: string[] },
  ) => Promise<void>;
  /** Org document templates available for attachment selection. */
  documentTemplates?: DocumentTemplate[];
}

function WorkflowEditorInner({
  templateId,
  templateName,
  initialNodes,
  initialEdges,
  readOnly = false,
  onSave,
  backHref = '/settings/workflows',
  onNodeEdit,
  documentTemplates,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [editNode, setEditNode] = useState<WorkflowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          { ...connection, type: 'smoothstep', animated: true } as WorkflowEdge,
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
      config: { subject?: string; body?: unknown; attach_document_template_ids?: string[] },
    ) => {
      if (!onNodeEdit) return;
      await onNodeEdit(tid, nodeId, config);
      // Update local node state so the dialog shows fresh data on reopen
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
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
    (node: WorkflowNode) => {
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
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
      );
      setSelectedNode((prev) =>
        prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev,
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
      <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2">
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
            nodes={readOnly
              ? nodes.map((n) => ({
                  ...n,
                  data: {
                    ...n.data,
                    dimmed: !EDITABLE_NODE_TYPES.includes(n.data.type as WorkflowNodeType),
                  },
                }))
              : nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeReconnect={onEdgeReconnect}
            onNodeClick={onNodeClick}
            onAddNode={onAddNode}
            onPaneClick={() => setSelectedNode(null)}
            readOnly={readOnly}
          />
        </main>

      </div>

      {!readOnly && selectedNode && (() => {
        const cfg = NODE_TYPES_CONFIG[selectedNode.data.type as WorkflowNodeType];
        const Icon = ((LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[cfg.icon]) ?? LucideIcons.Circle;
        const currentIndex = nodes.findIndex((n) => n.id === selectedNode.id);
        const prevNode = currentIndex > 0 ? nodes[currentIndex - 1] : null;
        const nextNode = currentIndex < nodes.length - 1 ? nodes[currentIndex + 1] : null;

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
                    <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{cfg.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 justify-center items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!prevNode}
                    onClick={(e) => { e.stopPropagation(); prevNode && setSelectedNode(prevNode); }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
                    {currentIndex + 1}/{nodes.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!nextNode}
                    onClick={(e) => { e.stopPropagation(); nextNode && setSelectedNode(nextNode); }}
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
                onUpdate={onUpdateNode}
                onClose={() => setSelectedNode(null)}
                documentTemplates={documentTemplates}
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
          documentTemplates={documentTemplates}
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
